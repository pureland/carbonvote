var express = require('express');
var async = require('async')

function Web(args) {
  this.redis = args.redis
  this.blackList = args.blackList
  this.listenPort = args.listenPort
  this.yesContractAddress = args.yesContractAddress
  this.noContractAddress = args.noContractAddress
  this.option_sum=args.option_sum
  this.option_address=args.option_address
  this.option_prefix=args.option_prefix
  this.amountHashTable=args.amountHashTable
}

Web.prototype.init = function() {
  this.app = express()
  this.app.set('view engine', 'ejs')
  this.app.disable('view cache')
  this.app.use(express.static('public'))

  let self = this

  let voteAmount = function(callback) {
    var i = 1
    let key = "amountHashTable"
    async.whilst(
      function () {
        return i <= op_sum
      },
      function (cb,resArr) {
        self.redis.hget(key, args.option_prefix + i, function (err, res) {
          resArr.push(res)
          i++
          cb(null)
        })
      },function(err){
          callback(null)
        })
  }
  let voteTxList = function(op_sum,resArr) {
    var i=1
    async.whilst(
      function () {
        return i <= op_sum
      },
      function (cb,resArr) {
        let key='TxSet-'+this.option_prefix+i
        self.redis.lrange(key, 0,20, function (err, res) {
          resArr.push(res)
          i++
          cb(null)
        })
      },function(err){
        //callback(null)
      })
  }

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
  var amountArr= new Array()
  var TxArr= new Array()
  var option_sum=self.option_sum
  this.app.get('/', function(req, res) {
    async.parallel([
      function(callback) {
        var i = 1
        let table = self.amountHashTable
        let key=self.option_prefix + i
        console.log(table,key)
        async.whilst(
            function () {
              return i <= option_sum
            },
            function (cb) {
              self.redis.hget(table, key, function (err, res) {
                amountArr.push(res)
                console.log("voteAmount",res)
                i++
                cb(null)
              })
            },function(err){
              if (i==option_sum)
              callback(null,amountArr)
            })
      },
      function(callback){
        var i=1
        async.whilst(
            function () {
              return i <= option_sum
            },
            function (cb) {
              let key='TxSet-'+self.option_prefix+i
              self.redis.lrange(key, 0,20, function (err, res) {
                TxArr.push(res)
                i++
                cb(null)
              })
            },function(err){
              if (i==option_sum)
              callback(null,TxArr)
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
      console.log("voteAmount :    ",amountArr)
      console.log("voteTxList :    ",TxArr)
      res.render('index', {
        option_address     : this.option_address,
        blackList          : self.blackList,
        voteAmount         : amountArr,
        voteTxList         : TxArr,
        lastBlock          : results[0]
      });
    })
  });


  this.app.listen(this.listenPort);
  console.log("listen on port :",this.listenPort);
}

module.exports = Web
