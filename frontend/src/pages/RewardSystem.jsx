import React, {useState} from "react";

export default function RewardSystem(){

const [coins,setCoins] = useState(100)
const [claimed,setClaimed] = useState(false)

const leaderboard = [
{name:"Player1",score:500},
{name:"Player2",score:420},
{name:"Player3",score:390},
{name:"Player4",score:300}
]

function claimReward(){

if(claimed){
alert("Reward already claimed")
return
}

setCoins(coins+20)
setClaimed(true)
alert("+20 Daily Coins")

}

return(

<div className="min-h-screen bg-gradient-to-b from-purple-700 to-black text-white p-6">

{/* WALLET */}

<div className="bg-slate-800 p-4 rounded-xl mb-6">

<h2 className="text-xl font-bold">
💰 Coins: {coins}
</h2>

</div>


{/* DAILY REWARD */}

<div className="bg-purple-600 p-5 rounded-xl mb-6">

<h2 className="text-lg font-bold">
🎁 Daily Reward
</h2>

<button
onClick={claimReward}
className="bg-yellow-400 text-black px-4 py-2 rounded-lg mt-3 hover:bg-yellow-300 transition">

Claim Reward

</button>

</div>


{/* LEADERBOARD */}

<h2 className="text-xl font-bold mb-4">
🏆 Leaderboard
</h2>

<div className="space-y-3">

{leaderboard.map((p)=>(
<div
key={p.name}
className="bg-slate-800 p-3 rounded-xl flex justify-between">

<span>{p.name}</span>
<span>{p.score}</span>

</div>
))}

</div>

</div>

)

}
