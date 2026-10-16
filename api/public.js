'use strict';
// GET /api/public  -> outlet and department names for the login screen (no secrets)
const { wrap, getConfig, publicView } = require('../lib/store');

module.exports = wrap(['GET'], async (req, res) => {
  res.status(200).json(publicView(await getConfig()));
});
