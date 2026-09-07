'use client';

import React, { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import CheckoutModal from './CheckoutModal';
import styles from './CartDrawer.module.css';

interface CartDrawerProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function CartDrawer({ isOpen: propsIsOpen, onClose: propsOnClose }: CartDrawerProps) {
  const { cartItems, removeFromCart, updateQuantity, isCartOpen: contextIsOpen, closeCart: contextClose } = useCart();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isOpen = propsIsOpen !== undefined ? propsIsOpen : contextIsOpen;
  const handleClose = propsOnClose || contextClose;

  // Prevent scrolling when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleRemoveItem = (id: string) => {
    removeFromCart(id);
  };

  const handleQuantityChange = (id: string, newQuantity: number) => {
    if (newQuantity > 0) {
      updateQuantity(id, newQuantity);
    }
  };

  const handleProceedToCheckout = () => {
    if (cartItems.length === 0) return;
    handleClose();
    setIsCheckoutOpen(true);
  };

  const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const total = subtotal;

  if (!mounted) return null;

  return (
    <>
      <div 
        className={`${styles.overlay} ${isOpen ? styles.open : ''}`} 
        onClick={handleClose}
        aria-hidden="true"
      />
      <div className={`${styles.drawer} ${isOpen ? styles.open : ''}`} role="dialog" aria-modal="true">
        <div className={styles.header}>
          <h2>Your Cart ({mounted ? cartItems.reduce((acc, i) => acc + i.quantity, 0) : 0})</h2>
          <button className={styles.closeBtn} onClick={handleClose} aria-label="Close cart">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className={styles.itemsContainer}>
          {!mounted || cartItems.length === 0 ? (
            <div style={{ textAlign: 'center', marginTop: '40px', color: '#777' }}>
              Your cart is empty
            </div>
          ) : (
            cartItems.map((item) => (
              <div key={item.id} className={styles.cartItem}>
                <div>
                   <img src={item.image} alt={item.name} className={styles.itemImage} />
                </div>
                <div className={styles.itemDetails}>
                  <div className={styles.itemHeader}>
                    <div>
                      <h3 className={styles.itemName}>{item.name}</h3>
                      <p className={styles.itemScale}>
                        Scale: {item.scale}{item.color ? ` • Color: ${item.color}` : ''}
                      </p>
                    </div>
                    <button 
                      className={styles.deleteBtn} 
                      onClick={() => handleRemoveItem(item.id)}
                      aria-label="Remove item"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                  <div className={styles.itemPriceRow}>
                    <div className={styles.quantityControl}>
                      <button className={styles.qtyBtn} onClick={() => handleQuantityChange(item.id, item.quantity - 1)}>-</button>
                      <span>{item.quantity}</span>
                      <button className={styles.qtyBtn} onClick={() => handleQuantityChange(item.id, item.quantity + 1)}>+</button>
                    </div>
                    <span className={styles.itemPrice}>₹{(item.price * item.quantity).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className={styles.footer}>
          <div className={styles.summaryRow}>
            <span>Subtotal</span>
            <span>₹{subtotal.toLocaleString('en-IN')}</span>
          </div>
          <div className={styles.totalRow}>
            <span>Total</span>
            <span>₹{total.toLocaleString('en-IN')}</span>
          </div>
          <button 
            className={styles.checkoutBtn}
            onClick={handleProceedToCheckout}
            disabled={cartItems.length === 0}
            style={cartItems.length === 0 ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
          >
            Proceed to Checkout
          </button>
        </div>
      </div>

      <CheckoutModal 
        isOpen={isCheckoutOpen} 
        onClose={() => setIsCheckoutOpen(false)} 
        items={cartItems} 
      />
    </>
  );
}

