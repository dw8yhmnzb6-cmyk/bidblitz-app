import React, {useState} from "react";

export default function MiningPage(){

const [coins,setCoins] = useState(0)
const [miners,setMiners] = useState([
{id:1,name:"Basic Miner",rate:1,active:true},
{id:2,name:"Pro Miner",rate:5,active:false,cost:100}
])

function mine(){
let total = miners.filter(m=>m.active).reduce((sum,m)=>sum+m.rate,0)
setCoins(coins+total)
}

function buyMiner(id){
let miner = miners.find(m=>m.id===id)
if(coins>=miner.cost){
setCoins(coins-miner.cost)
setMiners(miners.map(m=>m.id===id?{...m,active:true}:m))
}else{
alert("Nicht genug Coins!")
}
}

return(
<div className="min-h-screen bg-gradient-to-b from-amber-700 to-slate-900 text-white p-6">

<h1 className="text-3xl font-bold mb-2">⛏️ Mining</h1>
<p className="mb-6 opacity-70">Verdiene Coins durchs Mining</p>

<div className="bg-slate-800 p-4 rounded-xl mb-6">
<p className="text-sm opacity-70">Balance</p>
<p className="text-3xl font-bold">💰 {coins} Coins</p>
</div>

<button
onClick={mine}
className="w-full bg-amber-500 hover:bg-amber-400 p-4 rounded-xl text-xl font-bold mb-6 transition"
>
⛏️ Mine Now
</button>

<h2 className="text-xl font-bold mb-4">Miner</h2>

<div className="space-y-3">
{miners.map(m=>(
<div key={m.id} className="bg-slate-800 p-4 rounded-xl flex justify-between items-center">
<div>
<p className="font-bold">{m.name}</p>
<p className="text-sm opacity-70">+{m.rate} Coins/click</p>
</div>
{m.active ? (
<span className="text-green-400">✓ Aktiv</span>
) : (
<button
onClick={()=>buyMiner(m.id)}
className="bg-purple-600 px-4 py-2 rounded-lg"
>
{m.cost} 💰
</button>
)}
</div>
))}
</div>

</div>
)
}
