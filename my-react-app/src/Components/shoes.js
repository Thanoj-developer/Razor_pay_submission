import { useState, createElement } from 'react';

// Plays the role of ACP's merchant product-feed layer — structured catalog data an agent can filter, as opposed to a webpage.
export const PRODUCTS = [
  { id: "shoe_001", name: "Nike Air Jordan 1 Low", category: "shoes", price: 1999, currency: "INR", stock: 10, image: "/images/air_jordan.png" },
  { id: "shoe_002", name: "Dify Magsic Chunky Sneaker", category: "shoes", price: 1899, currency: "INR", stock: 5, image: "/images/chunky_sneaker.jpg" },
  { id: "shoe_003", name: "Classic Navy Suede Oxford", category: "shoes", price: 999, currency: "INR", stock: 0, image: "/images/blue_suede.png" },
  { id: "shoe_004", name: "Casual Retro Green Sneaker", category: "shoes", price: 649, currency: "INR", stock: 15, image: "/images/green_sneaker.png" },
  { id: "shoe_005", name: "Cult Sport Trail Runner", category: "shoes", price: 899, currency: "INR", stock: 8, image: "/images/trail_running.png" },
  { id: "shoe_006", name: "Woodland Leather Boot", category: "shoes", price: 1599, currency: "INR", stock: 3, image: "/images/blue_suede.png" },
  { id: "shoe_007", name: "Converse Street Sneaker", category: "shoes", price: 1299, currency: "INR", stock: 12, image: "/images/green_sneaker.png" }
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

  return createElement('div', { style: { padding: '24px 20px', maxWidth: '1000px', margin: '0 auto', textAlign: 'left', fontFamily: 'system-ui, -apple-system, sans-serif' } },
    createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid var(--border, #e5e7eb)', paddingBottom: '20px', marginBottom: '24px' } },
      createElement('div', null,
        createElement('h1', { style: { margin: 0, fontSize: '28px', fontWeight: '700', color: 'var(--text-h, #111827)' } }, '👟 Shoes Collection'),
        createElement('p', { style: { margin: '4px 0 0', color: 'var(--text, #6b7280)', fontSize: '14px' } }, 'ACP Merchant Product Catalog Feed')
      ),
      createElement('div', { style: { display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' } },
        createElement('input', { 
          placeholder: 'Search shoes...', 
          value: q, 
          onChange: e => setQ(e.target.value), 
          style: { padding: '10px 14px', border: '1px solid var(--border, #d1d5db)', borderRadius: '8px', background: 'var(--bg, #fff)', color: 'var(--text-h, #111)', fontSize: '14px', width: '200px', outline: 'none' } 
        }),
        createElement('label', { style: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: '500', color: 'var(--text-h, #374151)' } },
          `Max: ₹${max}`,
          createElement('input', { 
            type: 'range', 
            min: '500', 
            max: '2000', 
            step: '50', 
            value: max, 
            onChange: e => setMax(Number(e.target.value)),
            style: { cursor: 'pointer' }
          })
        )
      )
    ),
    createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '24px' } },
      items.map(p =>
        createElement('div', { 
          key: p.id, 
          product: p.name, 
          price: p.price, 
          'data-product': p.name, 
          'data-price': p.price, 
          style: { 
            border: '1px solid var(--border, #e5e7eb)', 
            padding: '16px', 
            borderRadius: '12px', 
            background: 'var(--code-bg, #f9fafb)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            transition: 'transform 0.2s, box-shadow 0.2s'
          } 
        },
          createElement('span', { style: { display: 'none' } }, `price:${p.price},product:${p.name}`),
          createElement('div', { style: { position: 'relative', overflow: 'hidden', borderRadius: '8px', background: '#fff', marginBottom: '14px' } },
            createElement('img', { 
              src: p.image, 
              alt: p.name, 
              style: { width: '100%', height: '190px', objectFit: 'contain', display: 'block', padding: '6px', background: '#ffffff' } 
            }),
            createElement('span', { style: { position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' } }, p.category)
          ),
          createElement('div', null,
            createElement('h3', { style: { margin: '0 0 8px', fontSize: '16px', fontWeight: '600', color: 'var(--text-h, #111)' } }, p.name),
            createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' } },
              createElement('span', { style: { fontSize: '18px', fontWeight: '700', color: 'var(--text-h, #111)' } }, `₹${p.price}`),
              createElement('span', { style: { fontSize: '12px', color: '#059669', background: '#d1fae5', padding: '2px 8px', borderRadius: '4px', fontWeight: '600' } }, `${p.stock} in stock`)
            )
          )
        )
      )
    )
  );
}
