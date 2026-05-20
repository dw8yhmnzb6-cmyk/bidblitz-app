const FALLBACKS = {
  phone: "https://images.unsplash.com/photo-1697636979311-511164585ca9?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA3MDB8MHwxfHNlYXJjaHwxfHxzbWFydHBob25lJTIwcHJvZHVjdCUyMHN0dWRpb3xlbnwwfHx8fDE3NzkyMjE2NzR8MA&ixlib=rb-4.1.0&q=85",
  console: "https://images.pexels.com/photos/15822009/pexels-photo-15822009.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  audio: "https://images.unsplash.com/photo-1557315360-6a350ab4eccd?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwxfHxoZWFkcGhvbmVzJTIwcHJvZHVjdCUyMHN0dWRpb3xlbnwwfHx8fDE3NzkyMjE2NzN8MA&ixlib=rb-4.1.0&q=85",
  laptop: "https://images.pexels.com/photos/129205/pexels-photo-129205.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  scooter: "https://images.unsplash.com/photo-1597260491619-bab87197869f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzV8MHwxfHNlYXJjaHwxfHxlbGVjdHJpYyUyMHNjb290ZXIlMjBwcm9kdWN0fGVufDB8fHx8MTc3OTIyMTY3NHww&ixlib=rb-4.1.0&q=85",
  camera: "https://images.unsplash.com/photo-1581017232414-4bb1668e8349?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxNzV8MHwxfHNlYXJjaHwxfHxjYW1lcmElMjBwcm9kdWN0JTIwc3R1ZGlvfGVufDB8fHx8MTc3OTIyMTY3NHww&ixlib=rb-4.1.0&q=85",
  coffee: "https://images.pexels.com/photos/30298107/pexels-photo-30298107.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  speaker: "https://images.pexels.com/photos/14309814/pexels-photo-14309814.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  watch: "https://images.unsplash.com/photo-1638095562082-449d8c5a47b4?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzR8MHwxfHNlYXJjaHwxfHxzbWFydHdhdGNoJTIwcHJvZHVjdCUyMHN0dWRpb3xlbnwwfHx8fDE3NzkyNzAwOTB8MA&ixlib=rb-4.1.0&q=85",
  bag: "https://images.unsplash.com/photo-1575403538007-acb790100421?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBoYW5kYmFnJTIwcHJvZHVjdHxlbnwwfHx8fDE3NzkyNzAwOTB8MA&ixlib=rb-4.1.0&q=85",
  shoes: "https://images.pexels.com/photos/12628400/pexels-photo-12628400.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  beauty: "https://images.pexels.com/photos/3993449/pexels-photo-3993449.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  xr: "https://images.pexels.com/photos/4523094/pexels-photo-4523094.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  robot: "https://images.unsplash.com/photo-1765970101376-4d5153f56e81?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTJ8MHwxfHNlYXJjaHwxfHxyb2JvdCUyMHZhY3V1bSUyMHByb2R1Y3R8ZW58MHx8fHwxNzc5MjcwMDkwfDA&ixlib=rb-4.1.0&q=85",
  chair: "https://images.unsplash.com/photo-1770195483917-b3bb444b7a29?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njl8MHwxfHNlYXJjaHwxfHxnYW1pbmclMjBjaGFpciUyMHByb2R1Y3QlMjBzdHVkaW98ZW58MHx8fHwxNzc5MjIxNjg5fDA&ixlib=rb-4.1.0&q=85",
  drone: "https://images.unsplash.com/photo-1649857114280-0df8879c9034?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzR8MHwxfHNlYXJjaHwxfHxkcm9uZSUyMHByb2R1Y3QlMjBzdHVkaW98ZW58MHx8fHwxNzc5MjIxNjg4fDA&ixlib=rb-4.1.0&q=85",
  bike: "https://images.unsplash.com/photo-1666360058702-a3aa07227c53?w=600&h=400&fit=crop&q=80",
  generic: "https://images.pexels.com/photos/5412270/pexels-photo-5412270.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
};

export function getAuctionFallbackImage(auction = {}) {
  const text = `${auction?.title || ""} ${auction?.category || ""}`.toLowerCase();
  if (/(iphone|galaxy|pixel|phone|smartphone|xiaomi|oneplus|honor|watch|ipad|tablet|kindle)/.test(text)) return FALLBACKS.phone;
  if (/(switch|playstation|xbox|console)/.test(text)) return FALLBACKS.console;
  if (/(airpods|bose|sony|headphone|soundbar|earbud)/.test(text)) return FALLBACKS.audio;
  if (/(macbook|laptop|notebook|monitor)/.test(text)) return FALLBACKS.laptop;
  if (/(scooter|segway|ninebot|boosted|board)/.test(text)) return FALLBACKS.scooter;
  if (/(watch|fenix|garmin)/.test(text)) return FALLBACKS.watch;
  if (/(louis vuitton|chanel|gucci|prada|dior|bag|neverfull|flap|marmont|galleria|lady d-joy)/.test(text)) return FALLBACKS.bag;
  if (/(nike|adidas|yeezy|jordan|sneaker|shoe)/.test(text)) return FALLBACKS.shoes;
  if (/(dyson|ghd|airwrap|styler|beauty)/.test(text)) return FALLBACKS.beauty;
  if (/(quest|vision pro|xr|vr)/.test(text)) return FALLBACKS.xr;
  if (/(roborock|irobot|roomba|vacuum)/.test(text)) return FALLBACKS.robot;
  if (/(camera|gopro|sony a7)/.test(text)) return FALLBACKS.camera;
  if (/(coffee|barista|espresso|delonghi|breville)/.test(text)) return FALLBACKS.coffee;
  if (/(speaker|homepod|sonos|nest|audio)/.test(text)) return FALLBACKS.speaker;
  if (/(chair|secretlab|herman miller)/.test(text)) return FALLBACKS.chair;
  if (/(drone|dji|mavic|mini 4)/.test(text)) return FALLBACKS.drone;
  if (/(bike|vanmoof|cowboy)/.test(text)) return FALLBACKS.bike;
  return FALLBACKS.generic;
}