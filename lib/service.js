let indexd = require('indexd')
let leveldown = require('leveldown')
let qup = require('qup')
let rpc = require('./rpc')
let zmq = require('zmq')

let debug = require('debug')('service')
let debugZmq = require('debug')('zmq')
let debugZmqTx = require('debug')('zmq:tx')
let debugZmqBlock = require('debug')('zmq:block')


module.exports = function initialize (callback) {
  function errorSink (err) {
    if (err) debug(err)
  }

  debug(`Init leveldb @ ${process.env.INDEXDB}`)
  let db = leveldown(process.env.INDEXDB)
  let adapter = new indexd(db, rpc)

  db.open({
    writeBufferSize: 1 * 1024 * 1024 * 1024
  }, (err) => {
    if (err) return callback(err, adapter)
    debug(`Opened leveldb @ ${process.env.INDEXDB}`)

    let zmqSock = zmq.socket('sub')
    zmqSock.connect(process.env.ZMQ)
    zmqSock.subscribe('hashblock')
    zmqSock.subscribe('hashtx')

    let lastSequence = {}
    zmqSock.on('message', (topic, message, sequence) => {
      topic = topic.toString('utf8')
      message = message.toString('hex')
      sequence = sequence.readUInt32LE()

      // if any ZMQ messages were lost,  assume a resync is required
      if (lastSequence[topic] !== undefined && (sequence !== (lastSequence[topic] + 1))) {
        debugZmq(`${sequence - lastSequence[topic] - 1} messages lost`)
        lastSequence[topic] = sequence
        adapter.tryResync(errorSink)
      }
      lastSequence[topic] = sequence

      debugZmq(`message = ${message}. topic = ${topic}`)

      // resync every block
      if (topic === 'hashblock') {
        debugZmqBlock(topic, message)
        return adapter.tryResync(errorSink)
      } else if (topic === 'hashtx') {
        debugZmqTx(topic, message)
        return adapter.notify(message, errorSink)
      }
    })

    adapter.tryResync(errorSink)
    adapter.tryResyncMempool(errorSink)
    callback(null, adapter)

  })
}
