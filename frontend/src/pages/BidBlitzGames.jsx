import React from "react";

export default function BidBlitzGames(){

const games = [

{icon:"🍬",name:"Candy Match"},
{icon:"🎡",name:"Lucky Wheel"},
{icon:"⚡",name:"Reaction"},
{icon:"🎴",name:"Scratch Card"},
{icon:"🧠",name:"Puzzle"},
{icon:"🐍",name:"Snake"},
{icon:"🚗",name:"Racing"},
{icon:"🏃",name:"Runner"},
{icon:"🎯",name:"Target"},
{icon:"🪙",name:"Coin Flip"},
{icon:"🧱",name:"Block Break"},
{icon:"🧩",name:"Memory"}

]

return(

<div className="min-h-screen bg-gradient-to-b from-purple-700 to-black text-white p-6">

<h1 className="text-3xl font-bold mb-6">
🎮 BidBlitz Gaming
</h1>

<div className="grid grid-cols-3 gap-4">

{games.map((g)=>(
<div
key={g.name}
className="bg-slate-800 hover:bg-slate-700 transition p-5 rounded-xl text-center cursor-pointer"
>

<div className="text-3xl">
{g.icon}
</div>

<p className="mt-2 text-sm font-semibold">
{g.name}
</p>

</div>
))}

</div>

</div>

)

}
