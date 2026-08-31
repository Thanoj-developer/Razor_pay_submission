import { useState, createElement } from 'react';

// Plays the role of ACP's merchant product-feed layer — structured catalog data an agent can filter, as opposed to a webpage.
export const PRODUCTS = [
  { id: "shoe_001", name: "Nike Air Max", category: "shoes", price: 1999, currency: "INR", stock: 10 },
  { id: "shoe_002", name: "Adidas Ultraboost", category: "shoes", price: 1899, currency: "INR", stock: 5 },
  { id: "shoe_003", name: "Puma Classic Suede", category: "shoes", price: 999, currency: "INR", stock: 0 },
  { id: "shoe_004", name: "Bata Casual Sneaker", category: "shoes", price: 649, currency: "INR", stock: 15 },
  { id: "shoe_005", name: "Red Tape Walking Shoes", category: "shoes", price: 899, currency: "INR", stock: 8 },
  { id: "shoe_006", name: "Woodland Leather Boot", category: "shoes", price: 1599, currency: "INR", stock: 3 },
  { id: "shoe_007", name: "Converse Chuck Taylor All Star", category: "shoes", price: 1299, currency: "INR", stock: 12 }
];

if (typeof window === 'undefined') {
  const express = (await import(/* @vite-ignore */ 'express')).default;
  const cors = (await import(/* @vite-ignore */ 'cors')).default;
  const app = express().use(cors());

  // Plays the role of ACP's merchant product-feed layer — structured catalog data an agent can filter, as opposed to a webpage.
  app.get('/products', (req, res) => {
    const { query, max_price, category } = req.query;
    if (max_price !== undefined && isNaN(Number(max_price))) return res.status(400).json({ error: "invalid_max_price" });
    const max = max_price !== undefined ? Number(max_price) : null;
    res.json({ products: PRODUCTS.filter(p => p.stock > 0 && (!category || p.category.toLowerCase() === category.toLowerCase()) && (max === null || p.price <= max) && (!query || p.name.toLowerCase().includes(query.toLowerCase()))) });
  });
  app.listen(process.env.PORT || 3000, () => console.log('Server running'));
}

export default function Shoes() {
  const [q, setQ] = useState(''), [max, setMax] = useState(2000);
  const items = PRODUCTS.filter(p => p.stock > 0 && p.price <= max && p.name.toLowerCase().includes(q.toLowerCase()));

  return createElement('div', { style: { padding: 20, textAlign: 'left', maxWidth: 800, margin: '0 auto' } },
    createElement('h2', null, 'Shoes Catalog'),
    createElement('div', { style: { display: 'flex', gap: 20, margin: '20px 0' } },
      createElement('input', { placeholder: 'Search...', value: q, onChange: e => setQ(e.target.value), style: { padding: 8 } }),
      createElement('label', null,
        `Max: ₹${max} `,
        createElement('input', { type: 'range', min: '500', max: '2000', value: max, onChange: e => setMax(Number(e.target.value)) })
      )
    ),
    createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 } },
      items.map(p =>
        createElement('div', { key: p.id, style: { border: '1px solid var(--border)', padding: 16, borderRadius: 8, background: 'var(--code-bg)' } },
          createElement('h4', null, p.name),
          createElement('p', null, `₹${p.price} (${p.stock} left)`)
        )
      )
    )
  );
}
