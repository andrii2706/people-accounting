/** A person of the list drawn on the sign-in page (made-up data, a picture of what the module does). */
export interface PreviewRecruit {
  initials: string;
  name: string;
  rank: string;
  state: { text: string; tone: 'green' | 'amber' | 'blue' };
}
