var express = require('express');
var router = express.Router();
const axios = require('axios').default;
const mongoose = require('mongoose')
const moment = require('moment');

const BASE_API_URL = 'http://localhost:1414'

const secureAuth = async (req, res, next) => {
  console.log('right')
  const token = req.cookies["dragonfly-token"]
  console.log(token, "TOKEn")
  const account = await getDragonflyAccount(token)
  console.log(account, "middle")
  if (account == null) {
    return res.status(401).render('error', { message: "Error while authenticating. Please try again later.", backUrl: null, error: "auth_timeout", final: true })
  }
  req.account = account
  next()
}

router.use(secureAuth)

router.get('/', async (req, res) => {
  const token = req.cookies["dragonfly-token"]
  const account = req.account
  const dragonflyUUID = account.uuid

  const minecraftAccounts = await getLinkedMinecraftAccounts(account.linkedMinecraftAccounts)

  const statistics = await mongoose.connection.db.collection('statistics').findOne({ dragonflyUUID: dragonflyUUID });

  let totalPlaytime = 0
  let monthlyPlaytime = 0

  account.creationDate = moment(account.creationDate).format('LL');

  if (statistics) {
    totalPlaytime = statistics.onlineTime.total
    for (var key in statistics.onlineTime) {
      if (statistics.onlineTime.hasOwnProperty(key)) {
        const contains = key.split('/')[0] == new Date().getMonth() + 1
        if (contains) monthlyPlaytime = statistics.onlineTime[key]
      }
    }
  }
  res.render('sites/index', { account: account, linkedMinecraftAccounts: minecraftAccounts, path: req.path, totalPlaytime: totalPlaytime, monthlyPlaytime: monthlyPlaytime })
})

router.get('/cosmetics', async (req, res) => {
  const token = req.cookies["dragonfly-token"]
  const account = req.account
  const dragonflyUUID = account.uuid
  const dragonflyCosmetics = await loadCosmetics(dragonflyUUID)
  console.log(dragonflyCosmetics)

  async function loadCosmetics(uuid) {
    const result = await axios.get(`${BASE_API_URL}/v1/cosmetics/find?dragonfly=${uuid}`, {}, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    return result.data.cosmetics
  }
  console.log(loadAvailableCosmetics, "LOAD")

  const availableCosmetics = await loadAvailableCosmetics()

  async function loadAvailableCosmetics() {
    const result = await axios.get(`${BASE_API_URL}/v1/cosmetics/available`)
    return result.data.availableCosmetics
  }

  console.log(loadAvailableCosmetics, "AVAILABLE")

  const cosmeticModels = []
  for (cosmetic of dragonflyCosmetics) {
    const model = availableCosmetics.find(element => element.cosmeticId == cosmetic.cosmeticId)
    cosmeticModels.push(model)
  }

  const minecraftAccounts = await getLinkedMinecraftAccounts(account.linkedMinecraftAccounts)

  res.render('sites/cosmetics', { account: account, path: req.path, cosmeticModels: cosmeticModels, cosmetics: dragonflyCosmetics, linkedMinecraftAccounts: minecraftAccounts })
})

router.get('/account', async (req, res) => {
  const token = req.cookies["dragonfly-token"]
  const account = req.account
  account.creationDate = moment(account.creationDate).format('LL');
  const dragonflyUUID = account.uuid
  console.log(dragonflyUUID, "uuid")
  // const dragonflyCosmetics = await loadCosmetics(dragonflyUUID)
  // console.log(dragonflyCosmetics)

  // async function loadCosmetics(uuid) {
  //   const result = await axios.get(`https://api.playdragonfly.net/v1/cosmetics/find?dragonfly=${uuid}`, {}, {
  //     headers: {
  //       'Authorization': `Bearer ${token}`
  //     }
  //   })
  //   return result.data.cosmetics
  // }

  // const availableCosmetics = await loadAvailableCosmetics()

  // async function loadAvailableCosmetics() {
  //   const result = await axios.get(`https://api.playdragonfly.net/v1/cosmetics/available`)
  //   return result.data.availableCosmetics
  // }

  // const cosmeticModels = []
  // for (cosmetic of dragonflyCosmetics) {
  //   const model = availableCosmetics.find(element => element.cosmeticId == cosmetic.cosmeticId)
  //   cosmeticModels.push(model)
  // }

  const ranks = {
    0: "Player",
    6: "Contributor",
    7: "Partner",
    8: "Moderator",
    9: "Developer",
    10: "Operator/Manager"
  };
  const permissionLevel = account.permissionLevel;

  Object.keys(ranks).map(function (key, index) {
    if (key == permissionLevel) {
      account.rank = ranks[key]
    }
  });
  console.log(account)

  const minecraftAccounts = await getLinkedMinecraftAccounts(account.linkedMinecraftAccounts)

  res.render('sites/account', { account: account, linkedMinecraftAccounts: minecraftAccounts })
})

async function getDragonflyAccount(token) {
  let account;
  await axios.post(`${BASE_API_URL}/v1/authentication/token`, {}, {
    timeout: 6000,
    headers: {
      "Authorization": `Bearer ${token}`
    }
  })
    .then(result => {
      account = result.data
    })
    .catch(err => {
      console.log(err)
      if (err) {
        console.log(err)
      }
    })

  return account
}

async function getMinecraftName(uuid) {
  const response = await axios.get(`https://api.minetools.eu/uuid/${uuid}`);
  return response.data.name;
}

async function getLinkedMinecraftAccounts(linkedMinecraftAccounts) {
  const mcAccounts = []
  for (let i = 0; i < linkedMinecraftAccounts.length; i++) {
    const accountName = await getMinecraftName(linkedMinecraftAccounts[i])
    const mcAcc = {
      minecraftName: accountName,
      uuid: linkedMinecraftAccounts[i],
    }
    mcAccounts.push(mcAcc)
  }
  return mcAccounts
}

// Security while development
// router.get('/', async (req, res) => {
//   const dragonflyToken = req.cookies["dragonfly-token"]
//   if (!dragonflyToken) return res.render("error", { message: 'Please login in order to see this content.', backUrl: "https://playdragonfly.net", paymentId: null })
//   const result = await axios.post('https://api.playdragonfly.net/v1/authentication/token', {}, {
//     headers: {
//       "Authorization": `Bearer ${dragonflyToken}`
//     }
//   })
//   const dragonflyUsername = result.data.username
//   if (MODE === "DEVELOPMENT") {
//     if (result.data.permissionLevel <= 8) return res.render("error", { message: 'You don\'t have permission to access this resource.', backUrl: "https://playdragonfly.net", paymentId: null })
//     return res.render('index', { title: 'Express!', username: dragonflyUsername });
//   }
//   res.render('index', { title: 'Express!', username: dragonflyUsername })
// })

module.exports = router;
