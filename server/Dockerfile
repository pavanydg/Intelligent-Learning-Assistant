FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

# Install ffmpeg and yt-dlp in the image
RUN apk add --no-cache ffmpeg python3 py3-pip \
  && pip install --no-cache-dir yt-dlp \
  && ln -sf /usr/bin/python3 /usr/bin/python

RUN npm ci --only=production

COPY . .

EXPOSE 4001

CMD ["npm", "start"]
