'use strict'
var async = require('async')

function Pool(args) {
  this.redis = args.redis
  this.web3  = args.web3
  //this.type  = args.type
  this.option_sum=args.option_sum
  this.option_prefix=args.option_prefix
  this.blackList = Object.keys(args.blackList).map(key => args.blackList[key])
  this.allVoteaddress=Object.keys(args.option_address).map(key => args.option_address[key])
  this.accountVoteTable=args.AccountVoteTable;
    this.VoteAmountTable=args.VoteAmountTable;
    this.option_address=args.option_address;
  this.firstVote=1;
    this.againVote=2;
    this.txOut=3;
    this.TxIn=4;
    this.txChange=5;
  this.TxList=args.TxList
    this.TxSet=args.TxSet
    this.AccountBalance=args.AccountBalance
    this.votemap= new Map()
    this.redis.hgetall(this.accountVoteTable,function(err,res){
        this.votemap=res
        console.log(this.votemap)
    })
    this.accountBalanceGetBlock=args.accountBalanceGetBlock
    this.typeName=["firstVote","againVote","txOut","TxIn"]
}
Pool.prototype.getTx=function(txHash){
    return this.web3.eth.getTransaction(txHash)
}
Pool.prototype.adjustType=function(tx,mainCB){
    console.log(this.votemap)
    var ifcb=true
    var oldVote=this.votemap[tx.from]
    var voteNo=this.allVoteaddress.indexOf(tx.to)+1
    console.log(voteNo)
    if (voteNo) {
        if (oldVote==undefined){
            this.votemap[tx.from]=voteNo
            ifcb=false
            this.process(tx, 0, voteNo, this.firstVote, mainCB)
        }
        else 
        {   this.votemap[tx.from]=voteNo
            ifcb=false
            this.process(tx,oldVote,voteNo,this.againVote,mainCB)
        }
    }
    else
        this.detectOrUpdateAccount(tx, mainCB)
}
Pool.prototype.process = function(tx,oldvote,newvote,type, mainCB) {
    console.log("tx.from",tx.from,"tx.to:",tx.to,"hash: ",tx.hash,"type :",this.typeName[type-1])
    console.log("oldvote: ",oldvote,"newvote: ",newvote)
  this.type=type
  this.oldvote=oldvote
  this.newvote=newvote
  this.address = this.option_address[this.option_prefix+newvote]
  this.txSet  = this.TxSet

    this.voteTxListOld=this.TxList+this.option_prefix+this.oldvote
    this.voteTxListNew=this.TxList+this.option_prefix+this.newvote

  this.accountBalanceTableNew = this.AccountBalance+ this.option_prefix+this.newvote
  this.accountBalanceTableOld = this.AccountBalance + this.option_prefix+this.oldvote
  this.vote(tx,mainCB)
}
Pool.prototype.vote = function(tx, mainCB) {
    let self = this
    let txHash=tx.hash
    let account=tx.from
    let accountIn=tx.to
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
        self.redis.sismember(self.txSet, txHash, function (err, res) {
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
            ['sadd', self.txSet, txHash]
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
                self.redis.hget(self.accountBalanceTableOld, account, function (err, res) {
                    let balance = Number(res)
                    cb(null, balance)
                })
            },
            function (balance, cb) {
                let wei = self.web3.eth.getBalance(account)
                let currentBalance = self.web3.fromWei(wei, 'ether').toString()
                console.log("currentBalance:",currentBalance)
                let txValue=self.web3.fromWei(tx.value,'ether').toString()
                let amountKeyNew = self.option_prefix + self.newvote
                let amountKeyOld = self.option_prefix + self.oldvote
                // TODO if (oldvote=newvote),
                console.log("type :",self.type)
                if (self.type == self.againVote)
                    self.redis.multi([
                        ['LREM', self.voteTxListOld, 1,txHash],
                        ['lpush', self.voteTxListNew, txHash],
                        ['sadd', self.txSet, txHash],
                        ['hdel', self.accountBalanceTableOld, account],
                        ['hset', self.accountBalanceTableNew, account,balance],
                        ['hset', self.accountVoteTable, account, self.newvote],
                        ['HINCRBYFLOAT', self.VoteAmountTable, amountKeyOld, -balance],
                        ['HINCRBYFLOAT', self.VoteAmountTable, amountKeyNew, balance]
                    ]).exec(function (err, res) {
                        console.log("err:",err)
                        console.log('decrease balance from vote ', amountKeyOld, ':', balance, "add balance to new vote", amountKeyNew, ":", balance)
                        cb(null)
                        })
/*                if (self.type == self.txOut)
                    self.redis.multi([
                        //['hdel', self.accountHashTableOld, account],
                        // decrease txValue do not include fee consume
                        ['HINCRBYFLOAT', self.VoteAmountTable, amountKeyOld, currentBalance-balance],
                        ['HINCRBYFLOAT', self.accountBalanceTableOld, account, currentBalance]
                    ]).exec(function (err, res) {
                        console.log(err)
                        console.log('tx out decrease balance from other vote ', amountKeyOld, ':', txValue,"tx.value",tx.value)
                        cb(null)
                    })
                if (self.type == self.TxIn) {
                    self.redis.multi([
                        //['hdel', self.accountHashTableOld, account],
                        ['HINCRBYFLOAT', self.VoteAmountTable, amountKeyNew, currentBalance-balance],
                        ['HINCRBYFLOAT', self.accountBalanceTableNew, account, currentBalance]
                    ]).exec(function (err, res) {
                        console.log(err)
                        console.log('tx in increase balance  ', amountKeyNew, ':', txValue)
                        cb(null)
                    })
                }*/
            }], function (err) {
                callback(null, 'done')
            })
    }
    function addAccount(callback) {
        console.log("addAccount")
        let wei = self.web3.eth.getBalance(account)
        let currentBalance = self.web3.fromWei(wei, 'ether').toString()
        let amountKeyNew = self.option_prefix + self.newvote
        //let amountKeyOld = self.option_prefix + self.oldvote
        console.log("a new vote :")
        self.redis.multi([
            ['lpush', self.voteTxListNew, txHash],
            ['sadd', self.txSet, txHash],
            ['hset', self.accountVoteTable, account, self.newvote],
            ['hset', self.accountBalanceTableNew, account, currentBalance ],
            ['HINCRBYFLOAT', self.VoteAmountTable, amountKeyNew, currentBalance]
        ]).exec(function (err, res) {
            console.log('add account vote', self.accountVoteTable, ':', account,": ",self.newvote)
            console.log('update balance', self.VoteAmountTable, ':', currentBalance)
            console.log(err)
            callback(null, res)
        })
    }

    if (self.type == self.firstVote)
        async.series([
            checkAccountInBlackList,
            //checkTxHasBeenProcessed,
            //addTx,
            addAccount
        ], function (err, res) {
            console.log("maincb callback")
            mainCB(null, 'done')
        })
    if (self.type == self.againVote || self.type == self.txOut || self.type == self.TxIn)
        async.series([
            checkAccountInBlackList,
            //checkTxHasBeenProcessed,
            changeAccountVote
        ], function (err, res) {
            mainCB(null, 'done')
        })
}
Pool.prototype.detectOrUpdateAccount = function(tx, mainCB) {
    let self = this

    // detect if tx.to isn't exists (create contract tx)
    //   account exists in vote pool
    //     get previous account's balance
    //       remove previous balance from amount
    //       add current balance to amount

    async.everySeries([tx.from, tx.to], function(account, escb) {
        async.waterfall([
            function(cb) {
                if (account) {
                    cb(null, account)
                } else {
                    cb(true) // break flow
                }
            },
            function(account, cb) {
                self.redis.hget(self.accountVoteTable, account, function(err, res) {
                    if (res)
                        cb(null, account, res)
                    else
                        cb(true)
                })
            },
            function(account,op, cb) {
                let key=self.AccountBalance+self.option_prefix+op
                self.redis.hget(key, account, function(err, res) {
                    if (res) {
                        let keyVote=self.option_prefix + op
                        cb(null, account, Number(res), key, keyVote)
                    }
                    else
                        cb(true)
                })
            },
            function(account, prevBalance, key,keyVote,cb) {
                let wei     = self.web3.eth.getBalance(account)
                let balance = self.web3.fromWei(wei, 'ether').toString()

                self.redis.multi([
                    ['HINCRBYFLOAT', self.VoteAmountTable,keyVote, balance-prevBalance],
                    ['hset', key, account, balance]
                ]).exec(function(err, res) {
                    console.log('update account', self.VoteAmountTable, ':',keyVote,"  ",balance-prevBalance)
                    console.log('update balance', self.accountVoteTable, ':',account, balance)
                    cb(null)
                })
            }
        ], function(err) {
            escb(null, 'done') // End of async.everySeries
        })
    }, function(err, res) {
        mainCB(null, 'done')
    })
}
module.exports = Pool


