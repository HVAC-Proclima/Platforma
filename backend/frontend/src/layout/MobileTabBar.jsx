const tabs = ["Clienți", "Lucrări", "Stoc", "Materiale"]

export default function MobileTabBar() {
  return (
    <nav className="h-16 bg-proclima-panel border-t border-gray-800 flex justify-around items-center text-xs">
      {tabs.map(tab => (
        <button
          key={tab}
          className="flex flex-col items-center gap-1 text-gray-300"
        >
          <span>{tab}</span>
        </button>
      ))}
    </nav>
  )
}
