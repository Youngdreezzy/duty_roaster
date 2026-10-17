// Starting setup, taken from the handwritten Vibes Lounge roster.
// The supervisor can edit staff names and duty posts in the app (Settings tab),
// so spelling mistakes here are easy to fix after deploying.

const mk = (prefix, names) => names.map((name, i) => ({ id: prefix + (i + 1), name }));

const DEFAULT_CONFIG = {
  outlets: [
    {
      id: 'vibes',
      name: 'Vibes Lounge',
      departments: [
        {
          id: 'waitress',
          name: 'Waitress',
          posts: ['Apt', 'AM Bread', 'PM Bread', 'Garden', 'Odogwu', 'Premium', 'AM Waitress', 'K-Cashier', 'VIP', 'Off'],
          staff: mk('w', ['Feyikemi', 'Iyanu', 'Faith', 'Odunayo', 'Zainab', 'Blessing', 'Oyindamola',
            'Eniola', 'Deborah', 'Temitope', 'Bolanle', 'Bose', 'Pelumi', 'Ebun']),
        },
        {
          id: 'supervisors',
          name: 'Supervisors',
          posts: ['ON', 'AM', 'OFF'],
          staff: mk('s', ['Segun', 'Tosi', 'Wole', 'T.J', 'Wendy']),
        },
        {
          id: 'kitchen',
          name: 'Kitchen',
          posts: ['ON', 'OFF'],
          staff: mk('k', ['Esther', 'Feyi', 'Ola', 'Mariam', 'Nfeng', 'Keny']),
        },
      ],
    },
  ],
};

// Sample week (12-18 Oct 2026) transcribed from the handwritten sheet.
// Cells that were crossed out or unreadable are left blank on purpose.
const SAMPLE_WEEK = '2026-10-12';
const SAMPLE = {
  waitress: {
    w1: ['Apt', 'PM Bread', 'Garden', 'Garden', 'Premium', 'AM Waitress', 'VIP'],
    w2: ['Off', 'Garden', 'Garden', 'Odogwu', 'VIP', 'K-Cashier', 'AM Bread'],
    w3: ['PM Bread', 'Apt', 'Odogwu', 'Off', 'K-Cashier', 'Garden', 'Apt'],
    w4: ['AM Bread', 'Garden', 'Off', 'PM Bread', 'Apt', 'AM Bread', 'Odogwu'],
    w5: ['Apt', 'Odogwu', 'AM Waitress', 'Off', 'Garden', 'Premium', 'Garden'],
    w6: ['VIP', 'Off', 'Apt', 'Premium', 'AM Waitress', 'Odogwu', 'Garden'],
    w7: ['Off', 'AM Waitress', 'VIP', 'Apt', 'Garden', 'Garden', 'Garden'],
    w8: ['Off', 'VIP', 'Apt', 'Garden', 'PM Bread', 'Garden', 'Garden'],
    w9: ['Garden', 'Premium', 'AM Bread', 'Off', 'Off', '', 'Premium'],
    w10: ['AM Waitress', 'Off', 'Premium', 'Apt', 'Garden', '', 'PM Bread'],
    w11: ['Off', 'Garden', 'Garden', 'Garden', 'Apt', 'Garden', 'AM Waitress'],
    w12: ['Garden', 'Apt', 'Off', 'AM Bread', 'Garden', 'PM Bread', 'Garden'],
    w13: ['Odogwu', 'Off', 'PM Bread', 'AM Waitress', 'Garden', 'Garden', 'Apt'],
    w14: ['Garden', 'AM Bread', 'Off', 'VIP', 'Odogwu', 'Apt', 'Garden'],
  },
  supervisors: {
    s1: ['OFF', 'ON', 'ON', 'ON', 'ON', 'ON', 'ON'],
    s2: ['AM', 'AM', 'OFF', '', 'AM', 'AM', 'AM'],
    s3: ['ON', 'ON', 'OFF', 'ON', 'ON', 'ON', 'ON'],
    s4: ['OFF', 'ON', 'ON', 'ON', 'ON', 'ON', 'ON'],
    s5: ['ON', 'ON', 'AM', 'OFF', 'OFF', 'ON', 'ON'],
  },
  kitchen: {
    k1: ['OFF', 'ON', 'OFF', 'ON', 'OFF', 'ON', 'OFF'],
    k2: ['ON', 'OFF', 'ON', 'OFF', 'ON', 'OFF', 'ON'],
    k3: ['ON', 'OFF', 'ON', 'OFF', 'ON', 'OFF', 'ON'],
    k4: ['OFF', 'ON', 'OFF', 'ON', 'OFF', 'ON', 'OFF'],
    k5: ['ON', 'OFF', 'ON', 'OFF', 'ON', 'OFF', 'ON'],
    k6: ['OFF', 'ON', 'OFF', 'ON', 'OFF', 'ON', 'OFF'],
  },
};

module.exports = { DEFAULT_CONFIG, SAMPLE_WEEK, SAMPLE };
