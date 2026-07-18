export const PROFILE_ID = "22222222-2222-7222-8222-222222222222";
export const INSTALLATION_ID = "33333333-3333-7333-8333-333333333333";
export const MANIFEST_ID = "org.stremio.cinemeta";

export const moviePreview = {
  id: "tt1254207",
  type: "movie",
  name: "Big Buck Bunny",
  poster: "https://example.com/bbb.jpg",
  releaseInfo: "2008",
};

export const seriesPreview = {
  id: "tt0944947",
  type: "series",
  name: "Game of Thrones",
  poster: "https://example.com/got.jpg",
};

export const discoveryHome = {
  rows: [
    {
      installation_id: INSTALLATION_ID,
      addon_name: "Cinemeta",
      catalog_id: "top",
      content_type: "movie",
      title: "Popular Movies",
      items: [moviePreview, seriesPreview],
    },
  ],
  warnings: [
    {
      installation_id: INSTALLATION_ID,
      addon_name: "Cinemeta",
      message: "Catalog fetch was slow",
    },
  ],
};

export const discoverySearch = {
  rows: [
    {
      installation_id: INSTALLATION_ID,
      addon_name: "Cinemeta",
      catalog_id: "search",
      content_type: "movie",
      title: "Search results",
      items: [moviePreview],
    },
  ],
  warnings: [],
};

export const movieMeta = {
  id: "tt1254207",
  type: "movie",
  name: "Big Buck Bunny",
  poster: "https://example.com/bbb.jpg",
  description: "A large bunny adventure.",
  releaseInfo: "2008",
  genres: ["Animation"],
  videos: [],
};

export const seriesMeta = {
  id: "tt0944947",
  type: "series",
  name: "Game of Thrones",
  description: "Iron throne drama.",
  genres: ["Drama"],
  videos: [
    {
      id: "tt0944947:1:1",
      title: "Winter Is Coming",
      season: 1,
      episode: 1,
      overview: "Ned Stark arrives.",
    },
    {
      id: "tt0944947:1:2",
      title: "The Kingsroad",
      season: 1,
      episode: 2,
    },
  ],
};

export const libraryEntries = [
  {
    profile_id: PROFILE_ID,
    media_key: "movie:imdb:tt1254207",
    media_type: "movie",
    name: "Big Buck Bunny",
    poster: "https://example.com/bbb.jpg",
    meta_snapshot: null,
    removed: false,
    added_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

export const addons = [
  {
    id: INSTALLATION_ID,
    manifest_id: MANIFEST_ID,
    name: "Cinemeta",
    version: "1.0.0",
    enabled: true,
    priority: 0,
    capabilities: {
      resources: ["catalog", "meta", "stream"],
      types: ["movie", "series"],
      id_prefixes: ["tt"],
    },
    installed_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];
