import React, { useState } from "react";

export default function RideModule(){

  const [coins,setCoins] = useState(1007)

  function startRide(cost){

    if(coins < cost){
      alert("Not enough coins")
      return
    }

    setCoins(coins-cost)
    alert("Ride started")
  }

  return(

    <div className="bg-slate-900 text-white min-h-screen p-6">

      {/* WALLET */}

      <div className="bg-gradient-to-r from-purple-600 to-blue-500 p-6 rounded-xl mb-6">

        <p className="text-sm opacity-80">
        Wallet Balance
        </p>

        <h2 className="text-3xl font-bold">
        {coins} Coins
        </h2>

      </div>


      {/* RIDE SERVICES */}

      <h2 className="text-xl font-bold mb-4">
      Ride Services
      </h2>

      <div className="grid grid-cols-3 gap-4">


        <button
        onClick={()=>startRide(50)}
        className="bg-yellow-500 p-5 rounded-xl text-center">

        <div className="text-3xl">🚕</div>
        <p className="font-semibold mt-2">Taxi</p>
        <p className="text-xs">50 Coins</p>

        </button>


        <button
        onClick={()=>startRide(20)}
        className="bg-green-500 p-5 rounded-xl text-center">

        <div className="text-3xl">🛴</div>
        <p className="font-semibold mt-2">Scooter</p>
        <p className="text-xs">20 Coins</p>

        </button>


        <button
        onClick={()=>startRide(10)}
        className="bg-blue-500 p-5 rounded-xl text-center">

        <div className="text-3xl">🚲</div>
        <p className="font-semibold mt-2">Bike</p>
        <p className="text-xs">10 Coins</p>

        </button>

      </div>

    </div>

  )

}
