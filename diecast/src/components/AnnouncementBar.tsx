'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { apiGetNews, NewsItem } from '../utils/api';
import styles from './AnnouncementBar.module.css';

export default function AnnouncementBar() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let isSubscribed = true;
    async function loadNews() {
      try {
        const data = await apiGetNews();
        if (isSubscribed && data && data.length > 0) {
          setNews(data);
        }
      } catch (e) {
        console.error('Error loading news', e);
      } finally {
        if (isSubscribed) setMounted(true);
      }
    }
    loadNews();
    return () => { isSubscribed = false; };
  }, []);

  // Ensure enough items in a single group so that it seamlessly covers ultra-wide screens without gaps
  const displayItems = useMemo(() => {
    if (!news || news.length === 0) return [];
    let items = [...news];
    while (items.length < 8) {
      items = [...items, ...news];
    }
    return items;
  }, [news]);

  if (!mounted || displayItems.length === 0) return null;

  // Maintain a smooth, constant ~65px/sec scroll speed across different item counts
  const scrollDuration = Math.max(25, Math.min(60, displayItems.length * 4.5));

  return (
    <div 
      className={styles.announcementBar}
      style={{ '--scroll-duration': `${scrollDuration}s` } as React.CSSProperties}
    >
      <div className={styles.scrollingText}>
        <div className={styles.scrollingTrack}>
          {/* Primary Group */}
          <div className={styles.trackGroup}>
            {displayItems.map((item, idx) => (
              <div key={`msg-a-${idx}`} className={styles.messageItem}>
                <span className={styles.message}>{item.text}</span>
              </div>
            ))}
          </div>

          {/* Duplicate Group for seamless, gapless 60fps infinite loop */}
          <div className={styles.trackGroup} aria-hidden="true">
            {displayItems.map((item, idx) => (
              <div key={`msg-b-${idx}`} className={styles.messageItem}>
                <span className={styles.message}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
