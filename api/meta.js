const { config, send } = require("./_lib");

// Public: outlet and department names, duty posts and minimums. No staff names.
module.exports = async (req, res) => {
  const outlets = {};
  for (const [outlet, depts] of Object.entries(config.outlets)) {
    outlets[outlet] = {};
    for (const [dept, info] of Object.entries(depts)) {
      outlets[outlet][dept] = { posts: info.posts };
    }
  }
  send(res, 200, { outlets, minimums: config.minimums });
};
