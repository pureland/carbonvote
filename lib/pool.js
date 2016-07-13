var async = require('async')

function Pool(args) {
  this.redis = args.redis
  this.web3  = args.web3
  //this.type  = args.type
  this.option_sum=args.option_sum
  this.option_prefix=args.option_prefix
  this.blackList = Object.keys(args.blackList).map(key => args.blackList[key])
  this.allVoteaddress=Object.keys(args.option_address).map(key => args.option_address[key])
  this.accountVoteTable="accountVoteTable"
    this.amountHashTable=args.amountHashTable;
    this.option_address=args.option_address;
  this.firstVote=1;
    this.againVote=2;
    this.txOut=3;
    this.TxIn=4;

}
Pool.prototype.getTx=function(txHash){
    return this.web3.eth.getTransaction(txHash)
}
Pool.prototype.process = function(tx,oldvote,newvote,type, mainCB) {
  this.type=type
  this.oldvote=oldvote
  this.newvote=newvote
  this.address = this.option_address[this.option_prefix+newvote]
  this.txSetKey  = 'vote-' + this.option_prefix+this.type + '-tx-set'

    this.voteTxSetOld='TxSet-'+this.option_prefix+this.oldvote
    this.voteTxSetNew='TxSet-'+this.option_prefix+this.newvote

  this.accountHashTableNew = 'vote-' + this.option_prefix+this.newvote
  this.accountHashTableOld = 'vote-' + this.option_prefix+this.oldvote

    console.log("get a new tx   ","type:",this.type,"oldvote:",this.oldvote,"newvote:",this.newvote)
    
  this.vote(tx,mainCB)
}
Pool.prototype.vote = function(tx, mainCB) {
    let self = this
    let txHash=tx.hash
    let account=tx.from

    function checkAccountInBlackList(callback) {
        console.log("check blacklist:")
        if (self.blackList.includes(account)) {
            console.log('vote account in blacklist', account)
            return callback(true)
        } else {
            return callback(null)
        }
    }

    function checkTxHasBeenProcessed(callback) {
        console.log("checkTxHasBeenProcessed:")
        self.redis.sismember(self.txSetKey, txHash, function (err, res) {
            if (res > 0) {
                console.log('tx has been processed', txHash)
                return callback(true, res)
            } else {
                return callback(null, res)
            }
        })
    }

    function addTx(callback) {
        console.log("addTx:")
        self.redis.multi([
            ['sadd', self.txSetKey, txHash]
        ]).exec(function (err, res) {
            console.log('store tx', txHash)
            callback(null, res)
        })
    }

    function changeAccountVote(callback) {
        //let key = self.accountHashTableOld
        console.log("changeAccountVote")
        async.waterfall([
            //get balance ,note the balance =currentbalance +fee of this tx
            function (cb) {
                self.redis.hget(self.accountHashTableOld, account, function (err, res) {
                    let balance = Number(res)
                    cb(null, balance)
                })
            },
            function (balance, cb) {
                let wei = self.web3.eth.getBalance(account)
                let currentBalance = self.web3.fromWei(wei, 'ether').toString()
                let amountKeyNew = self.option_prefix + self.newvote
                let amountKeyOld = self.option_prefix + self.oldvote
                // TODO if (oldvote=newvote),
                console.log("type",self.type)
                if (this.type == self.againVote)
                    self.redis.multi([
                        ['smove', self.voteTxSetOld, txHash],
                        ['sadd', self.voteTxSetNew, txHash],
                        ['sadd', self.txSetKey, txHash],
                        ['hdel', self.accountHashTableOld, account],
                        ['hset', self.accountHashTableNew, account],
                        ['hset', self.accountVoteTable, account, this.newvote],
                        ['HINCRBYFLOAT', self.amountHashTable, amountKeyOld, -balance],
                        ['HINCRBYFLOAT', self.amountHashTable, amountKeyNew, currentBalance]]).exec(function (err, res) {
                        console.log("err:",err)
                        console.log('decrease balance from other vote ', self.this.amountKeyOld, ':', balance, "add balance to new vote", self.this.amountKeyNew, ":", currentBalance)
                        cb(null)

                    })
                if (this.type == this.txOut)
                    self.redis.multi([
                        ['hdel', self.accountHashTableOld, account],
                        ['HINCRBYFLOAT', self.amountHashTable, amountKeyOld, currentBalance - balance]]).exec(function (err, res) {
                        console.log(err)
                        console.log('decrease balance from other vote ', amountKeyOld, ':', balance)
                        self.redis.hget(self.amountHashTable,amountKeyNew,function(err,res){
                            console.log("err,",err,"res :",res)
                        })
                        cb(null)
                    })
            }], function (err) {
                callback(null, 'done')
            })
    }

    function addAccount(callback) {
        console.log("addAccount")
        let wei = self.web3.eth.getBalance(account)
        let currentBalance = self.web3.fromWei(wei, 'ether').toString()
        let amountKeyNew = self.option_prefix + self.newvote
        let amountKeyOld = self.option_prefix + self.oldvote
        console.log("a new vote :")
        self.redis.multi([
            ['sadd', self.voteTxSetNew, txHash],
            ['sadd', self.txSetKey, txHash],
            ['hset', self.accountVoteTable, account, self.newvote],
            ['hset', self.accountHashTableNew, account, currentBalance ],
            ['HINCRBYFLOAT', self.amountHashTable, amountKeyNew, currentBalance]
        ]).exec(function (err, res) {
            console.log('update account', self.accountVoteTable, ':', account)
            console.log('update balance', self.amountHashTable, ':', currentBalance)
            console.log(err)
            self.redis.hget(self.amountHashTable,amountKeyNew,function(err,res){
                console.log(err,res)
            })
            callback(null, res)
        })
    }

    if (self.type == self.firstVote)
        async.series([
            checkAccountInBlackList,
            checkTxHasBeenProcessed,
            //addTx,
            addAccount
        ], function (err, res) {
            mainCB(null, 'done')
        })
    if (self.type == self.againVote || self.type == self.txOut)
        async.series([
            checkAccountInBlackList,
            checkTxHasBeenProcessed,
            changeAccountVote
        ], function (err, res) {
            mainCB(null, 'done')
        })
}
module.exports = Pool


