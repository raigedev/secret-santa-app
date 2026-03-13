<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
  {/* Secret Santa Card */}
  <div className="bg-red-500 text-white rounded-t-[2rem] rounded-b-xl shadow-lg hover:scale-105 transition transform relative overflow-hidden">
    <div className="bg-white text-red-600 font-bold py-2 text-center rounded-t-[2rem]">
      🔍🎅 Your Secret Santa
    </div>
    <div className="p-4 text-center">
      <p className="text-sm">Assignments will appear here</p>
      <div className="mt-4 flex justify-center gap-2 text-xl">
        🎁 🌲 🍬
      </div>
    </div>
    <div className="absolute top-2 left-2 text-xl">🍭</div>
    <div className="absolute bottom-2 right-2 text-xl">🎄</div>
  </div>

  {/* Gift Ideas Card */}
  <div className="bg-green-500 text-white rounded-t-[2rem] rounded-b-xl shadow-lg hover:scale-105 transition transform relative overflow-hidden">
    <div className="bg-white text-green-600 font-bold py-2 text-center rounded-t-[2rem]">
      💡🎅 Gift Ideas
    </div>
    <div className="p-4 text-center">
      <p className="text-sm">Share and explore festive gift ideas</p>
      <div className="mt-4 flex justify-center gap-2 text-xl">
        ❄️ 🎁 🍬
      </div>
    </div>
    <div className="absolute top-2 left-2 text-xl">🔔</div>
    <div className="absolute bottom-2 right-2 text-xl">🎀</div>
  </div>

  {/* Create Group Card */}
  <div
    onClick={() => router.push("/create-group")}
    className="cursor-pointer bg-blue-500 text-white rounded-t-[2rem] rounded-b-xl shadow-lg hover:scale-105 transition transform relative overflow-hidden"
  >
    <div className="bg-white text-blue-600 font-bold py-2 text-center rounded-t-[2rem]">
      📋🎉 Create Group
    </div>
    <div className="p-4 text-center">
      <p className="text-sm">Start a new Secret Santa event</p>
      <div className="mt-4 flex justify-center gap-2 text-xl">
        🎊 🎄 🎁
      </div>
    </div>
    <div className="absolute top-2 right-2 text-xl">🎅</div>
    <div className="absolute bottom-2 left-2 text-xl">⛄</div>
  </div>
</div>