import React, {useState} from "react";

export default function CandyGame(){

const [score,setScore] = useState(0)

function play(){

let win = Math.random()

if(win > 0.5){

setScore(score+10)
alert("You matched candies! +10 coins")

}else{

alert("Try again")

}

}

return(

<div className="min-h-screen bg-purple-900 text-white p-6">

<h1 className="text-3xl font-bold mb-4">
🍬 Candy Match
</h1>

<p className="mb-6">
Score: {score}
</p>

<div className="grid grid-cols-3 gap-3">

{Array(9).fill().map((_,i)=>(

<div
key={i}
onClick={play}
className="bg-pink-500 h-20 rounded-xl flex items-center justify-center text-2xl cursor-pointer hover:bg-pink-400 transition"
>

🍬

</div>

))}

</div>

</div>

)

}
