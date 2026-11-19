# nginx of «Військовий облік» (docker compose of the domain — see the portal repository, compose/)
FROM nginx:1.27-alpine
ENV OBLIK_WEB=oblik-web:4000 OBLIK_API=oblik-api:3000
COPY default.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 8080
