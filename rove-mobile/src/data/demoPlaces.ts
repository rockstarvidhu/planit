import type { ImageSourcePropType } from 'react-native';

export const categories = ['Cafe', 'Food', 'Nature', 'Date ideas'] as const;
export type DemoCategory = typeof categories[number];

export type DemoPlace = {
  id: string;
  name: string;
  category: Exclude<DemoCategory, 'Date ideas'>;
  tags: readonly DemoCategory[];
  area: string;
  city: string;
  description: string;
  photo: ImageSourcePropType;
};

/** Local sample content only: these are not verified listings or nearby results. */
export const demoPlaces: readonly DemoPlace[] = [
  {
    id: 'amaiya-cafe', name: 'Amaiya Café', category: 'Cafe', tags: ['Cafe', 'Date ideas'],
    area: 'HRBR Layout', city: 'Bengaluru',
    description: 'A warm café interior for an unhurried conversation. This sample listing is for interface preview only.',
    photo: require('../../assets/demo/amaiya-cafe.jpg'),
  },
  {
    id: 'salkara-kitchen', name: 'Salkara Malabar Kitchen', category: 'Food', tags: ['Food'],
    area: 'Dasarahalli', city: 'Bengaluru',
    description: 'A restaurant setting with a welcoming dining room. This sample listing is for interface preview only.',
    photo: require('../../assets/demo/salkara-kitchen.jpg'),
  },
  {
    id: 'lalbagh-garden', name: 'Lalbagh Botanical Garden', category: 'Nature', tags: ['Nature', 'Date ideas'],
    area: 'Lalbagh', city: 'Bengaluru',
    description: 'A leafy garden scene for a slower afternoon. This sample listing is for interface preview only.',
    photo: require('../../assets/demo/lalbagh-garden.jpg'),
  },
];
