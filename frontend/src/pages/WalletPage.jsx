import React, {useState} from "react";

export default function WalletPage(){

const [balance,setBalance] = useState(1200)
const [transactions] = useState([
{type:"earn",amount:50,desc:"Candy Game",time:"Heute"},
{type:"spend",amount:20,desc:"Scooter Ride",time:"Heute"},
{type:"earn",amount:100,desc:"Daily Reward",time:"Gestern"},
{type:"earn",amount:30,desc:"Mining",time:"Gestern"}
])

return(
<div className="min-h-screen bg-gradient-to-b from-purple-700 to-slate-900 text-white p-6">

<h1 className="text-3xl font-bold mb-6">💰 Wallet</h1>

<div className="bg-gradient-to-r from-purple-600 to-blue-500 p-6 rounded-xl mb-6">
<p className="text-sm opacity-80">Guthaben</p>
<p className="text-4xl font-bold">{balance} Coins</p>
</div>

<div className="grid grid-cols-2 gap-4 mb-6">
<button className="bg-green-500 p-4 rounded-xl font-bold">+ Einzahlen</button>
<button className="bg-slate-700 p-4 rounded-xl font-bold">Auszahlen</button>
</div>

<h2 className="text-xl font-bold mb-4">Transaktionen</h2>

<div className="space-y-3">
{transactions.map((tx,i)=>(
<div key={i} className="bg-slate-800 p-4 rounded-xl flex justify-between">
<div>
<p className="font-medium">{tx.desc}</p>
<p className="text-xs opacity-50">{tx.time}</p>
</div>
<p className={tx.type==="earn"?"text-green-400":"text-red-400"}>
{tx.type==="earn"?"+":"-"}{tx.amount}
</p>
</div>
))}
</div>

</div>
)
}
