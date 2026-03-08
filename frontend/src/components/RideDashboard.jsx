import React from "react";

export default function RideDashboard() {

  const rides = [
    {name:"Taxi", icon:"🚕", price:"50 Coins", link:"/ride/taxi"},
    {name:"Scooter", icon:"🛴", price:"20 Coins", link:"/ride/scooter"},
    {name:"Bike", icon:"🚲", price:"10 Coins", link:"/ride/bike"}
  ];

  return (
    <div className="bg-slate-900 p-5 rounded-2xl text-white">

      <h2 className="text-xl font-bold mb-4">
        Ride Services
      </h2>

      <div className="grid grid-cols-3 gap-4">

        {rides.map(r => (
          <button
            key={r.name}
            onClick={()=>window.location.href=r.link}
            className="bg-slate-800 hover:bg-slate-700 p-4 rounded-xl text-center transition"
          >

            <div className="text-3xl">
              {r.icon}
            </div>

            <p className="font-semibold mt-2">
              {r.name}
            </p>

            <p className="text-xs opacity-70">
              from {r.price}
            </p>

          </button>
        ))}

      </div>
    </div>
  );
}
