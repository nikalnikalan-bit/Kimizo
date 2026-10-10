// Run once:  node add-types.js
// 1) gives every existing product a Type (sub-category)  2) adds more products for every category.
// Safe to run again. Your own products are never deleted.
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'data', 'products.json');
const list = JSON.parse(fs.readFileSync(file, 'utf8'));

const subOf = {
  'Wireless Pink Headphones': 'Headphones', 'Mini Instant Camera': 'Cameras', 'Smart Fitness Band': 'Wearables', 'Portable Neck Fan': 'Gadgets',
  'Plush Bunny Toy': 'Plush', 'Teddy Bear Gift Set': 'Plush', 'Kids Lunch Box Set': 'Kids Essentials', 'Building Blocks Kit': 'Building Toys',
  'Insulated Pink Bottle': 'Drinkware', 'Aroma Diffuser': 'Aroma & Candles', 'Ceramic Tea Cup Set': 'Tea & Kitchen', 'Travel Organizer Pouch': 'Travel',
  'Korean Style Handbag': 'Bags', 'Minimal Sling Bag': 'Bags', 'Classic Silk Scarf': 'Scarves', 'Sakura Print Tee': 'Clothing',
  'LED Desk Lamp': 'Lighting', 'Bamboo Storage Box': 'Storage', 'Cozy Throw Blanket': 'Bedding & Decor',
  'Classic Leather Watch': 'Watches', 'Pearl Hair Clip Set': 'Hair Accessories', 'Polarized Sunglasses': 'Eyewear'
};
let tagged = 0;
for (const p of list) if (!p.sub && subOf[p.n]) { p.sub = subOf[p.n]; tagged++; }

const more = [
  // category, type, name, emoji, origin, price, mrp
  ['Electronics', 'Headphones', 'Wireless Earbuds', '🎧', 'Korea', 1299, 1999],
  ['Electronics', 'Headphones', 'Gaming Headset', '🎧', 'China', 1799, 2799],
  ['Electronics', 'Cameras', 'Compact Vlog Camera', '📸', 'Japan', 4999, 6999],
  ['Electronics', 'Wearables', 'Smart Watch Pro', '⌚', 'Korea', 2499, 3999],
  ['Electronics', 'Gadgets', 'Mini Power Bank', '🔋', 'China', 899, 1399],
  ['Electronics', 'Gadgets', 'Bluetooth Speaker', '🔊', 'Korea', 1499, 2299],
  ['Toys & Kids', 'Collectibles', 'Anime Figure Set', '🎎', 'Japan', 1299, 1899],
  ['Toys & Kids', 'Kids Essentials', 'Kids School Backpack', '🎒', 'Korea', 899, 1399],
  ['Toys & Kids', 'Building Toys', 'Wooden Puzzle Set', '🧩', 'Japan', 649, 999],
  ['Toys & Kids', 'Plush', 'Panda Plush', '🐼', 'China', 599, 899],
  ['Lifestyle', 'Aroma & Candles', 'Scented Candle Trio', '🕯️', 'Japan', 799, 1199],
  ['Lifestyle', 'Drinkware', 'Steel Lunch Flask', '🍶', 'Korea', 749, 1099],
  ['Lifestyle', 'Tea & Kitchen', 'Matcha Tea Set', '🍵', 'Japan', 1299, 1899],
  ['Lifestyle', 'Travel', 'Travel Neck Pillow', '✈️', 'China', 499, 799],
  ['Fashion', 'Clothing', 'Kimono Style Jacket', '🧥', 'Japan', 1999, 2999],
  ['Fashion', 'Clothing', 'Hanbok Style Dress', '👗', 'Korea', 2299, 3499],
  ['Fashion', 'Clothing', 'Mandarin Collar Shirt', '👔', 'China', 1199, 1799],
  ['Fashion', 'Bags', 'Mini Backpack', '🎒', 'Korea', 1399, 2099],
  ['Home Essentials', 'Lighting', 'Paper Lantern Light', '🏮', 'China', 699, 1099],
  ['Home Essentials', 'Bedding & Decor', 'Cushion Cover Set', '🛋️', 'Korea', 599, 899],
  ['Home Essentials', 'Storage', 'Wicker Basket Set', '🧺', 'Japan', 849, 1299],
  ['Accessories', 'Jewellery', 'Jade Bracelet', '📿', 'China', 999, 1599],
  ['Accessories', 'Jewellery', 'Silver Hoop Earrings', '💎', 'Korea', 699, 1099],
  ['Accessories', 'Watches', 'Smart Strap Watch', '⌚', 'Korea', 1599, 2499],
  ['Accessories', 'Hair Accessories', 'Ribbon Hair Bow Set', '🎀', 'Japan', 399, 649],
  ['Accessories', 'Eyewear', 'Round Sunglasses', '🕶️', 'Korea', 799, 1299]
];
let id = list.reduce((m, x) => Math.max(m, x.id), 0), added = 0;
for (const [c, sub, n, e, o, p, m] of more) {
  if (list.some(x => x.n === n)) continue;
  list.push({ id: ++id, n, e, c, sub, o, p, m, img: '' }); added++;
}
fs.writeFileSync(file, JSON.stringify(list, null, 2));
console.log(`Tagged ${tagged} existing products, added ${added} new. Total: ${list.length}`);
