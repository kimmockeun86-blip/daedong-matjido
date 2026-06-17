import { Award, Compass, Star, BarChart3 } from 'lucide-react';
import type { RestaurantRaw } from '../utils/excel';

interface DashboardProps {
  restaurants: RestaurantRaw[];
  onSelectRestaurant: (restaurant: RestaurantRaw) => void;
}

export default function Dashboard({ restaurants, onSelectRestaurant }: DashboardProps) {
  if (restaurants.length === 0) return null;

  // 1. 계산식
  const totalCount = restaurants.length;
  
  const avgRating = (restaurants.reduce((acc, curr) => acc + curr.rating, 0) / totalCount).toFixed(1);

  // 카테고리별 통계
  const categoryMap: Record<string, number> = {};
  restaurants.forEach(r => {
    categoryMap[r.category] = (categoryMap[r.category] || 0) + 1;
  });

  const categoriesSorted = Object.entries(categoryMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // 최고 평점 식당 3선
  const topRated = [...restaurants]
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 2x2 통계 Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '12px'
      }}>
        {/* 총 맛집 */}
        <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'rgba(6, 182, 212, 0.1)', padding: '10px', borderRadius: '8px', display: 'flex' }}>
            <Compass style={{ color: '#06b6d4', width: '20px', height: '20px' }} />
          </div>
          <div>
            <p style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '500' }}>총 맛집 수</p>
            <p style={{ color: '#f8fafc', fontSize: '20px', fontWeight: '700', marginTop: '2px' }}>{totalCount}개</p>
          </div>
        </div>

        {/* 평균 평점 */}
        <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'rgba(251, 191, 36, 0.1)', padding: '10px', borderRadius: '8px', display: 'flex' }}>
            <Star style={{ color: '#fbbf24', width: '20px', height: '20px' }} />
          </div>
          <div>
            <p style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '500' }}>평균 별점</p>
            <p style={{ color: '#f8fafc', fontSize: '20px', fontWeight: '700', marginTop: '2px' }}>★ {avgRating}</p>
          </div>
        </div>
      </div>

      {/* 카테고리 분포 (SVG 기반 미니 가로 바 차트) */}
      <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <BarChart3 style={{ width: '15px', height: '15px', color: '#3b82f6' }} />
          카테고리 별 분포
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {categoriesSorted.slice(0, 4).map((cat, idx) => {
            const percentage = ((cat.count / totalCount) * 100).toFixed(0);
            return (
              <div key={idx}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span style={{ color: '#cbd5e1', fontWeight: '500' }}>{cat.name}</span>
                  <span style={{ color: '#94a3b8' }}>{cat.count}개 ({percentage}%)</span>
                </div>
                {/* Custom Bar progress track */}
                <div style={{
                  width: '100%',
                  height: '6px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${percentage}%`,
                    height: '100%',
                    background: idx === 0 ? 'var(--accent-gradient)' : 'rgba(59, 130, 246, 0.6)',
                    borderRadius: '3px',
                    transition: 'width 1s ease'
                  }}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 최고 평점 맛집 리스트 */}
      <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Award style={{ width: '15px', height: '15px', color: '#fbbf24' }} />
          명예의 전당 (최고 평점)
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {topRated.map((item, idx) => (
            <div 
              key={idx}
              onClick={() => onSelectRestaurant(item)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 10px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.03)',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '75%' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.name}
                </span>
                <span style={{ fontSize: '10px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.address}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Star style={{ width: '12px', height: '12px', fill: '#fbbf24', color: '#fbbf24' }} />
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#fbbf24' }}>{item.rating.toFixed(1)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
