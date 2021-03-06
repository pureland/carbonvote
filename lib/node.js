var Web3 = require('web3')
var async = require('async')
//var math=require('Math')
var Pool = require(__dirname + '/pool')

function Node(args) {
  this.redis = args.redis

  this.web3  = new Web3()
  this.web3.setProvider(new this.web3.providers.HttpProvider(args.web3Config))

  this.startBlockNumber = args.startBlockNumber
  this.timeout = 15000

  this.Pool = new Pool(Object.assign({web3: this.web3}, args))
  this.voteaddress=args.option_address

}

Node.prototype.init = function() {
  if (this.web3.isConnected()) {
    console.log('Web3 connection established.')
    console.log('Start fetching data ...')
    this.startFetching()
  } else {
    console.log('Web3 connection failed.')
    this.stop()
  }
}

Node.prototype.getBlockNumber = function() {
  var number = 0;
  try {
    number = this.web3.eth.blockNumber - 6
  } catch(e) {
  } finally {
    return number
  }
}

Node.prototype.startFetching = function() {
  if (this.stopping) {
    return
  }
  let self = this

  async.waterfall([
    function(callback) {
      self.redis.get('processedBlockNumber', function(err, res) {
        let processedBlockNumber = Math.max(res,self.startBlockNumber)
        if (self.getBlockNumber() > processedBlockNumber) {
          callback(null, processedBlockNumber + 1)
        } else {
          callback(true)
        }
      })
    },
    function(blockNumber, callback) {
      console.log('processing block...', blockNumber)
      let txArrs=new Array
      let txHashs = self.web3.eth.getBlock(blockNumber).transactions
      for (var i=0;i<txHashs.length;i++){
          txArrs.push(self.web3.eth.getTransaction(txHashs[i]))
      }
      //console.log(txHashs[0])
      //console.log(typeof(txHashs),txHashs.length,tmp);
      if (txHashs.length)
        async.everySeries(txHashs, function(txHash, escb) {
          var tx=self.web3.eth.getTransaction(txHash)
          self.Pool.adjustType(tx,escb)
/*          self.redis.hget(self.Pool.accountVoteTable, tx.from, function(err, res) {
            console.log("tx.from",tx.from,"tx.to:",tx.to,"hash: ",tx.hash,"res :",res)
            if (res>0)
              if (self.Pool.allVoteaddress.includes(tx.to))
                self.Pool.process(tx,res,newvote,self.Pool.againVote, escb)
              else
                self.Pool.process(tx,res,0, self.Pool.txOut, escb)
            else if(self.Pool.allVoteaddress.includes(tx.to))
              self.Pool.process(tx,0,self.Pool.allVoteaddress.indexOf(tx.to)+1,self.Pool.firstVote, escb)
            if (err) {
              console.log("accountVoteTable err: ",err)
              escb(null, blockNumber)
            }
          })
          self.redis.hget(self.Pool.accountVoteTable, tx.to, function(err, res) {
            if(res){
              console.log("tx.from", tx.from, "tx.to:", tx.to, "res :", res)
              self.Pool.process(tx,0,res,self.Pool.TxIn, escb)
            }
            else
              escb(null, blockNumber)
          })*/
        },function(err){
          console.log("node.js cb")
          callback(null, blockNumber)
        })
      else
        callback(null, blockNumber)
    },
    function(blockNumber, callback) {
      self.redis.set('processedBlockNumber', blockNumber, function(err, res) {
        callback(null, res)
      })
    }
  ], function(err) {
    if (err) {
      console.log('Wait for 15 seconds and then continue...')
      setTimeout(self.startFetching.bind(self), self.timeout)
    } else {
      setTimeout(self.startFetching.bind(self), 200)
    }
  })
}

Node.prototype.stop = function() {
  this.stopping = true

  console.log('Stopping node process...')
}

module.exports = Node
