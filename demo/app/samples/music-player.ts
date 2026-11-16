// Adapted from google/A2UI (Apache-2.0): catalogs/basic/v1/examples/music-player.json
import type { ActionLike, Sample } from './types';

// Mock agent turns (added for this demo): play/pause flips the icon, and
// previous/next stream the neighbouring track into the data model.
const TRACKS = [
  {
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    totalTime: '4:22',
    albumArt:
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
  },
  {
    title: 'Glass Harbour',
    artist: 'The Night Ferries',
    totalTime: '3:51',
    albumArt:
      'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop',
  },
  {
    title: 'Paper Satellites',
    artist: 'Moth & Lantern',
    totalTime: '5:07',
    albumArt:
      'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=300&h=300&fit=crop',
  },
];

function respond(action: ActionLike): unknown[] | undefined {
  const surfaceId = action.surfaceId;
  if (action.name === 'playPause') {
    const playing = action.context?.['playIcon'] === 'pause';
    return [
      {
        version: '1.0',
        updateDataModel: {
          surfaceId,
          path: '/playIcon',
          value: playing ? 'play' : 'pause',
        },
      },
    ];
  }
  if (action.name !== 'next' && action.name !== 'previous') return undefined;
  const current = TRACKS.findIndex(
    (t) => t.title === action.context?.['title'],
  );
  const step = action.name === 'next' ? 1 : TRACKS.length - 1;
  const track = TRACKS[(Math.max(current, 0) + step) % TRACKS.length];
  return [
    {
      version: '1.0',
      updateDataModel: {
        surfaceId,
        value: {
          ...track,
          progress: 0,
          currentTime: '0:00',
          playIcon: 'pause',
        },
      },
    },
  ];
}

const sample: Sample = {
  id: 'music-player',
  name: 'Music Player',
  version: '1.0',
  group: 'Basic catalog',
  description:
    'Example of music player. Play, pause and skip are answered by the mock agent.',
  prompt: 'Play something to focus to.',
  respond,
  messages: [
    {
      version: '1.0',
      createSurface: {
        surfaceId: 'gallery-music-player',
        catalogId:
          'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json',
        sendDataModel: true,
      },
    },
    {
      version: '1.0',
      updateComponents: {
        surfaceId: 'gallery-music-player',
        components: [
          { id: 'root', component: 'Card', child: 'main_column' },
          {
            id: 'main_column',
            component: 'Column',
            children: [
              'album_art',
              'track_info',
              'progress',
              'time_row',
              'controls',
            ],
            align: 'center',
          },
          {
            id: 'album_art',
            component: 'Image',
            url: { '@path': '/albumArt' },
            fit: 'cover',
          },
          {
            id: 'track_info',
            component: 'Column',
            children: ['song_title', 'artist'],
            align: 'center',
          },
          { id: 'song_title', component: 'Text', text: { '@path': '/title' } },
          {
            id: 'artist',
            component: 'Text',
            text: { '@path': '/artist' },
            variant: 'caption',
          },
          {
            id: 'progress',
            component: 'Slider',
            value: { '@path': '/progress' },
            max: 1,
          },
          {
            id: 'time_row',
            component: 'Row',
            children: ['current_time', 'total_time'],
            justify: 'spaceBetween',
          },
          {
            id: 'current_time',
            component: 'Text',
            text: { '@path': '/currentTime' },
            variant: 'caption',
          },
          {
            id: 'total_time',
            component: 'Text',
            text: { '@path': '/totalTime' },
            variant: 'caption',
          },
          {
            id: 'controls',
            component: 'Row',
            children: ['prev_btn', 'play_btn', 'next_btn'],
            justify: 'center',
          },
          { id: 'prev_btn_icon', component: 'Icon', name: 'skipPrevious' },
          {
            id: 'prev_btn',
            component: 'Button',
            child: 'prev_btn_icon',
            action: {
              event: {
                name: 'previous',
                context: { title: { '@path': '/title' } },
              },
            },
          },
          {
            id: 'play_btn_icon',
            component: 'Icon',
            name: { '@path': '/playIcon' },
          },
          {
            id: 'play_btn',
            component: 'Button',
            child: 'play_btn_icon',
            action: {
              event: {
                name: 'playPause',
                context: { playIcon: { '@path': '/playIcon' } },
              },
            },
          },
          { id: 'next_btn_icon', component: 'Icon', name: 'skipNext' },
          {
            id: 'next_btn',
            component: 'Button',
            child: 'next_btn_icon',
            action: {
              event: {
                name: 'next',
                context: { title: { '@path': '/title' } },
              },
            },
          },
        ],
      },
    },
    {
      version: '1.0',
      updateDataModel: {
        surfaceId: 'gallery-music-player',
        value: {
          albumArt:
            'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
          title: 'Blinding Lights',
          artist: 'The Weeknd',
          album: 'After Hours',
          progress: 0.45,
          currentTime: '1:48',
          totalTime: '4:22',
          playIcon: 'pause',
        },
      },
    },
  ],
};

export default sample;
