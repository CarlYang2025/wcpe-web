import type { MviItem } from '../lib/types'

interface Props {
  items: MviItem[]
}

const RATING_COLORS: Record<string, string> = {
  '超级价值': '#a55eea',
  '高价值': '#00ff88',
  '一般价值': '#54a0ff',
  '无价值': '#555555',
}

export default function MviTable({ items }: Props) {
  if (!items || items.length === 0) {
    return <p className="text-xs text-[#555555]">暂无错价分析数据</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#1a1f3a] text-[#a0a0a0]">
            <th className="text-left py-1">投注选项</th>
            <th className="text-center py-1">模型%</th>
            <th className="text-center py-1">市场%</th>
            <th className="text-center py-1">MVI</th>
            <th className="text-center py-1">评级</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const ratingColor = RATING_COLORS[item.rating]
            return (
              <tr key={i} className="border-b border-[#1a1f3a]">
                <td className="py-1.5 text-white">{item.bet}</td>
                <td className="text-center py-1.5 font-mono text-[#54a0ff]">{Math.round(item.modelProb * 100)}%</td>
                <td className="text-center py-1.5 font-mono text-[#a0a0a0]">{Math.round(item.marketProb * 100)}%</td>
                <td className="text-center py-1.5 font-mono font-bold" style={{ color: ratingColor }}>
                  {item.mvi.toFixed(2)}
                </td>
                <td className="text-center py-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[9px]" style={{
                    backgroundColor: ratingColor + '20', color: ratingColor,
                  }}>
                    {item.rating}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
