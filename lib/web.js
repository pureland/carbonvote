'use strict'
var express = require('express');
var async = require('async')

function Web(args) {
  this.redis = args.redis
  this.blackList = args.blackList
  this.listenPort = args.listenPort
  this.option_sum=args.option_sum
  this.option_address=args.option_address
  this.option_prefix=args.option_prefix
  this.voteAmountTable=args.VoteAmountTable
  this.txList=args.TxList
  this.allVoteaddress=Object.keys(args.option_address).map(key => args.option_address[key])
}

Web.prototype.init = function() {
  this.app = express()
  this.app.set('view engine', 'ejs')
  this.app.disable('view cache')
  this.app.use(express.static('public'))

  let self = this
  let lastBlock = function(callback) {
    console.log("get last block");
    self.redis.get('processedBlockNumber', function(err, res) {
      if(err)
          console.log("getlastblock err:",err);
      else
        console.log("getlastblock :",res);
      callback(err, res)
    })
  }
  //var amountArr= new Array()
  var option_sum=self.option_sum
  this.app.get('/', function(req, res) {
    var TxArr= new Array()
    async.parallel([
      function(callback) {
        let table = self.voteAmountTable
        self.redis.hgetall(table, function (err, res) {
          //console.log(res)
          callback(null,res)
        })
      },
      function(callback){
        var i=1
        async.whilst(
          function () {
            return i <= option_sum
          },
          function (cb) {
            let key=self.txList+self.option_prefix+i
            self.redis.lrange(key, 0,20, function (err, res) {
              console.log("key:",key)
              //console.log(TxArr)
              TxArr.push(res)
              i++
              cb(null,"done")
            })
          },function(err,res){
              callback(null,"done")
          })
      },
      function(callback) {
        console.log("get last block");
        self.redis.get('processedBlockNumber', function(err, res) {
          if(err)
            console.log("getlastblock err:",err);
          else
            console.log("getlastblock :",res);
          callback(err, res)
        })
      }
    ],function(error, results) {
      console.log(self.option_address)
      console.log("results :    ",results[0])
      console.log("voteTxList :    ",TxArr)
      res.render('index', {
        option_address     : self.allVoteaddress,
        blackList          : self.blackList,
        voteAmount         : results[0],
        voteTxList         : TxArr,
        lastBlock          : results[2]
      });
    })
  });
  this.app.get('/vote', function(req, res) {
      var table = self.voteAmountTable

      self.redis.hgetall(table, function (err, results) {
        for(let i=1;i<=self.option_sum;i++)
        { var key=self.option_prefix+i
          if(results[key]==undefined)
              results[key]=0
        }
        console.log("/vote res:",results)
        res.send(JSON.stringify(results))
      })
    })

  this.app.listen(this.listenPort);
  console.log("listen on port :",this.listenPort);
}

module.exports = Web
