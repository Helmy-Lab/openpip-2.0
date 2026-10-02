# Built from the repository root (see docker-compose.yml) so the documentation
# site in docs/ can be bundled alongside the app.

# PUBLIC_URL (e.g. https://openpip.example.org/openpip) sets the app's base path
# and the address the docs' examples use. Empty: served at the domain root.
ARG PUBLIC_URL=

FROM python:3.12-slim AS docs
ARG PUBLIC_URL
ENV PUBLIC_URL=$PUBLIC_URL
WORKDIR /src
COPY docs/requirements.txt docs/requirements.txt
RUN pip install --no-cache-dir -r docs/requirements.txt
COPY mkdocs.yml ./
COPY docs/ docs/
# Link checking runs in the test suite; a broken link must not block an app
# deploy, so the image build does not run strict.
RUN mkdocs build --no-strict --site-dir /site

FROM node:20-alpine AS build
ARG PUBLIC_URL
ENV PUBLIC_URL=$PUBLIC_URL
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=docs /site /usr/share/nginx/docs
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
