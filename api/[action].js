// Entry point for every /api/<action> call.
// Loading the handler inside try/catch means a startup problem shows a readable message instead of a blank 500.
module.exports = async (req, res) => {
  let handler;
  try {
    handler = require('../lib/handler');
  } catch (e) {
    console.error(e);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Startup problem: ' + String(e && e.message).slice(0, 200) }));
  }
  return handler(req, res);
};
