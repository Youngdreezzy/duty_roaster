// Starting setup, taken from the handwritten rosters.
// Everything here can be edited inside the app (Settings tab), so spelling mistakes are easy to fix.
// Outlets listed here that are missing from the database are added automatically.

const mk = (prefix, names) => names.map((name, i) => ({ id: prefix + (i + 1), name }));

// Places a hotel waiter/waitress can be sent to cover. Shown as M·PB, N·RST ...
const HOTEL_COVERS = [
  { code: 'RST', name: 'Restaurant' },
  { code: 'KB', name: 'Karaoke Bar' },
  { code: 'PB', name: 'Pool Bar' },
  { code: 'AB', name: 'Apartment Bar' },
];
const HOTEL_NOTE = 'M = Morning, N = Night. A code after the shift (for example M·PB) means covering at that place.';

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
    {
      id: 'hotel',
      name: 'Hotel',
      departments: [
        {
          id: 'restaurant',
          name: 'Restaurant',
          note: HOTEL_NOTE,
          posts: ['M', 'N', 'OFF'],
          covers: HOTEL_COVERS,
          staff: mk('r', ['Mubat', 'Tayo', 'Najibat', 'Hammed', 'Beatrice', 'Michelle']),
        },
        {
          id: 'karaoke',
          name: 'Karaoke Bar',
          note: HOTEL_NOTE,
          posts: ['M', 'N', 'OFF'],
          covers: HOTEL_COVERS,
          staff: mk('kb', ['Roselyn', 'Rofiat', 'Deborah', 'Esther', 'Nike']),
        },
        {
          id: 'pool',
          name: 'Pool Bar',
          note: HOTEL_NOTE,
          posts: ['M', 'N', 'OFF'],
          covers: HOTEL_COVERS,
          staff: mk('pb', ['Dasola', 'Samuel']),
        },
      ],
    },
  ],
};

// Sample weeks transcribed from the handwritten sheets. Crossed-out or unclear cells are left blank.
// A value like 'M@PB' means shift M, covering at PB.
const SAMPLES = [
  {
    outlet: 'vibes',
    week: '2026-10-12',
    data: {
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
    },
  },
  {
    outlet: 'hotel',
    week: '2026-11-16',
    data: {
      restaurant: {
        r1: ['OFF', 'M', 'M', 'M', 'M', 'M', 'M'],
        r2: ['M', 'M', 'OFF', 'M', 'M', 'M', 'M'],
        r3: ['M', 'OFF', 'N', 'N', 'N', 'N', 'N'],
        r4: ['M@AB', 'N', 'OFF', 'N', 'N', 'N', 'N'],
        r5: ['N', 'OFF', 'M', 'M', 'M', 'M', 'M'],
        r6: ['N@KB', 'OFF', 'N@PB', 'N', 'N', 'N', 'N'],
      },
      karaoke: {
        kb1: ['M', 'M', 'M', 'OFF', 'M', 'M', 'M'],
        kb2: ['OFF', 'M@PB', 'M', 'M', 'M', 'M', 'M'],
        kb3: ['N', 'N@RST', 'N@RST', 'N', 'N', 'N', 'N'],
        kb4: ['OFF', 'N', 'N', 'N', 'N', 'N', 'N'],
        kb5: ['M@PB', 'N', 'N', 'OFF', 'N', 'N', 'N'],
      },
      pool: {
        pb1: ['N', 'OFF', 'M', 'M', 'M', 'M', 'M'],
        pb2: ['N@RST', 'N', 'OFF', 'N', 'N', 'N', 'N'],
      },
    },
  },
];

module.exports = { DEFAULT_CONFIG, SAMPLES };
