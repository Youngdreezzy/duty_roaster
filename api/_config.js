// Outlets, departments, duty posts and starting staff lists.
// Staff names can be edited later inside the supervisor page (Manage tab).
// Duty posts are changed here. Names marked "check" were read from handwriting.
module.exports = {
  outlets: {
    "Vibes Lounge": {
      Waitress: {
        posts: [
          "Apt",
          "AM Bread",
          "PM Bread",
          "Garden",
          "Odogwu",
          "Premium",
          "AM Waitress",
          "K-Cashier",
          "VIP",
          "Off",
        ],
        staff: [
          "Feyikemi",
          "Iyanu",
          "Faith",
          "Odunayo",
          "Zainab",
          "Blessing",
          "Oyindamola",
          "Eniola",
          "Deborah",
          "Temitope",
          "Botenle", // check spelling
          "Bose",
          "Pelumi",
          "Ebun",
        ],
      },
      Supervisors: {
        posts: ["AM", "ON", "OFF"],
        staff: ["Segun", "Tosi", "Wole", "T.J", "Wendy"], // check
      },
      Kitchen: {
        posts: ["ON", "OFF"],
        staff: ["Esther", "Feyi", "Ola", "Mariam", "Nfeng", "Kemy"], // check
      },
    },
    // The Hotel outlet will be added here once its sample roster is ready.
  },

  // Minimum people needed on a post each day. A red warning shows on the
  // supervisor page when a day has fewer. Key format: "Outlet|Department".
  // Example: "Vibes Lounge|Waitress": { "VIP": 1, "K-Cashier": 1 }
  minimums: {},
};
