import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service.js';
import { P7S_MIME, TEXT_MIME } from '../common/constants/mime.constants.js';
import { sha256 } from '../common/utils/hash.utils.js';
import { loadEnv } from '../config/env.js';
import { KepVerifierService } from '../kep/kep-verifier.service.js';
import { matchesSignatureName, samePerson } from '../kep/utils/person-name.utils.js';
import { LegalEntity } from '../legal-entities/legal-entity.entity.js';
import { LegalEntitiesService } from '../legal-entities/legal-entities.service.js';
import type { AuthUser } from '../shared/interfaces/auth.interface.js';
import type { KepSigner } from '../shared/interfaces/kep.interface.js';
import type { OfferDocument, OfferStatus } from '../shared/interfaces/subscription.interface.js';
import { StorageService } from '../storage/storage.service.js';
import { OfferGateService } from './offer-gate.service.js';
import { OfferSignature } from './offer-signature.entity.js';
import { SUBSCRIPTION_MANAGERS } from './subscriptions.constants.js';
import { SubscriptionsService } from './subscriptions.service.js';
import { TERMS_VERSION } from './terms.constants.js';
import { buildOfferDocument } from './utils/offer-document.utils.js';

/**
 * The offer is accepted only with the qualified e-signature of the head of the legal entity:
 * the document (the offer text + the statement of acceptance) is formed here, signed with the IIT widget
 * or any KEP program, the server checks the signature and that the signer is the head per the ЄДР.
 */
@Injectable()
export class OfferService {
  private readonly env = loadEnv();

  constructor(
    @InjectRepository(OfferSignature) private readonly signatures: Repository<OfferSignature>,
    @InjectRepository(LegalEntity) private readonly entities: Repository<LegalEntity>,
    private readonly subscriptions: SubscriptionsService,
    private readonly legalEntities: LegalEntitiesService,
    private readonly kep: KepVerifierService,
    private readonly gate: OfferGateService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  private canSign(user: AuthUser) {
    return SUBSCRIPTION_MANAGERS.includes(user.role);
  }

  private async entityOf(user: AuthUser): Promise<LegalEntity | null> {
    return user.legalEntityId ? this.entities.findOneBy({ id: user.legalEntityId }) : null;
  }

  async status(user: AuthUser): Promise<OfferStatus> {
    const entity = await this.entityOf(user);
    const signed = await this.signatures.findOne({
      where: { legalEntityId: user.legalEntityId ?? undefined, termsVersion: TERMS_VERSION, status: 'SIGNED' },
      order: { signedAt: 'DESC' },
    });
    return {
      version: TERMS_VERSION,
      required: this.gate.required(user),
      signed: entity?.offerVersion === TERMS_VERSION,
      signedAt: entity?.offerVersion === TERMS_VERSION ? entity.offerSignedAt : null,
      signerName: signed?.signerName ?? '',
      headName: entity ? `${entity.headPosition} ${entity.headName}`.trim() : '',
      entityName: entity ? entity.shortName || entity.fullName : '',
      canSign: !!entity && this.canSign(user),
      widget: {
        enabled: !!(this.env.signWidgetScriptUrl && this.env.signWidgetFrameUrl),
        scriptUrl: this.env.signWidgetScriptUrl,
        frameUrl: this.env.signWidgetFrameUrl,
      },
    };
  }

  /** A new acceptance document for the current version — the head signs exactly these bytes. */
  async document(user: AuthUser): Promise<OfferDocument> {
    const entity = await this.managed(user);
    if (!entity.headName.trim()) {
      throw new BadRequestException('У картці юрособи не вказано керівника — заповніть його й сформуйте документ');
    }
    const terms = await this.subscriptions.terms();
    const row = await this.signatures.save(
      this.signatures.create({
        legalEntityId: entity.id,
        termsVersion: TERMS_VERSION,
        document: '',
        documentSha256: '',
        requestedByUserId: user.id,
      }),
    );
    const text = buildOfferDocument({ id: row.id, createdAt: row.createdAt, terms, entity });
    const bytes = Buffer.from(text, 'utf8');
    await this.signatures.update(row.id, { document: text, documentSha256: sha256(bytes) });
    return { id: row.id, fileName: `oferta-${entity.edrpou}-${TERMS_VERSION}.txt`, content: bytes.toString('base64') };
  }

  async sign(user: AuthUser, id: string, signatureBase64: string): Promise<OfferStatus> {
    const entity = await this.managed(user);
    const row = await this.signatures.findOneBy({ id, legalEntityId: entity.id });
    if (!row) throw new NotFoundException('Документ не знайдено — сформуйте його ще раз');
    if (row.status === 'SIGNED') return this.status(user);
    if (row.termsVersion !== TERMS_VERSION) {
      throw new BadRequestException('Оферта оновилася — сформуйте документ ще раз і підпишіть нову редакцію');
    }
    const check = await this.kep.verify(Buffer.from(row.document, 'utf8'), Buffer.from(signatureBase64, 'base64'));
    await this.assertHead(entity, check.signer);

    const base = `offers/${entity.id}/${row.id}`;
    await this.storage.put(`${base}.txt`, Buffer.from(row.document, 'utf8'), TEXT_MIME);
    await this.storage.put(`${base}.txt.p7s`, check.der, P7S_MIME);
    const now = new Date();
    await this.signatures.update(row.id, {
      status: 'SIGNED',
      signerName: check.signer.fullName.slice(0, 300),
      signerDrfoMasked: check.signer.drfoMasked,
      signerIssuer: check.signer.issuer.slice(0, 500),
      kepLevel: check.level,
      signatureKey: `${base}.txt.p7s`,
      signedByUserId: user.id,
      signedAt: now,
    });
    await this.entities.update(entity.id, { offerVersion: TERMS_VERSION, offerSignedAt: now });
    this.gate.forget(entity.id);
    await this.audit.log(
      'legal_entity',
      entity.id,
      'OFFER_SIGNED',
      { version: [null, TERMS_VERSION], signer: [null, check.signer.fullName], kep: [null, check.level] },
      user,
    );
    return this.status(user);
  }

  /** The signer is the head: per the ЄДР when it answers, otherwise per the legal entity card. */
  private async assertHead(entity: LegalEntity, signer: KepSigner) {
    if (signer.edrpou && signer.edrpou !== entity.edrpou) {
      throw new BadRequestException(
        `Ключ належить іншій організації (код ${signer.edrpou}). Підпишіть ключем керівника цієї юрособи.`,
      );
    }
    const registryHead = this.env.companyRegistryUrl
      ? await this.legalEntities
          .lookup(entity.edrpou)
          .then((c) => c.headFullName)
          .catch(() => '')
      : '';
    const ok = registryHead
      ? samePerson(signer.fullName, registryHead)
      : matchesSignatureName(signer.fullName, entity.headName);
    if (!ok) {
      const head = registryHead || entity.headName || 'не вказано';
      throw new BadRequestException(
        `Підписав «${signer.fullName}», а керівник ${registryHead ? 'за ЄДР' : 'в картці юрособи'} — «${head}». ` +
          'Оферту підписує керівник своїм КЕП.',
      );
    }
  }

  private async managed(user: AuthUser): Promise<LegalEntity> {
    if (!this.canSign(user)) throw new ForbiddenException('Оферту від імені юрособи підписує керівник');
    const entity = await this.entityOf(user);
    if (!entity) throw new NotFoundException('Спершу додайте юридичну особу');
    return entity;
  }
}
