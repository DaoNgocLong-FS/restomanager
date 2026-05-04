FROM node:20-alpine

WORKDIR /app

# Install OS deps required by some npm packages (bcryptjs is pure JS so minimal)
RUN apk add --no-cache tini

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000

ENTRYPOINT ["/sbin/tini","--"]
CMD ["node","server.js"]
