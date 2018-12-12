FROM counterparty/base

# Install newest stable nodejs and npm
RUN apt-get update && apt-get -y remove nodejs npm gyp
RUN curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
RUN apt-get update && apt-get -y install nodejs
RUN echo "Using nodejs version `nodejs --version` and npm version `npm --version`"

# zmq
RUN apt-get install -y libzmq3-dev

# npm dependencies
RUN npm install -g node-gyp forever

# install counterparty-indexd
RUN mkdir -p /data/indexd/
COPY . /indexd
WORKDIR /indexd

ARG ENV_FILE=".env-example"
COPY ./$ENV_FILE /indexd/.env

RUN npm install
RUN npm rebuild

# start script
COPY ./docker/start.sh /usr/local/bin/start.sh
RUN chmod a+x /usr/local/bin/start.sh


# start indexd
# CMD ["start.sh"]
CMD ["/sbin/init"]
