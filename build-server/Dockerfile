FROM ubuntu:focal

RUN apt-get upgrade

RUN apt-get update && apt-get install -y curl git

RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash -

RUN apt-get install -y nodejs

WORKDIR /home/app


COPY main.sh main.sh
COPY script.js script.js
COPY package*.json .

RUN npm install

RUN chmod +x main.sh
RUN chmod +x script.js

ENTRYPOINT [ "/home/app/main.sh" ]