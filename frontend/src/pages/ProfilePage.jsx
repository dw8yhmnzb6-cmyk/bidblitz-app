import React, {useState} from "react";

export default function ProfilePage(){

const [user] = useState({
name:"Max Mustermann",
email:"max@bidblitz.ae",
coins:1200,
level:5,
gamesPlayed:42,
totalEarned:5000
})

const menuItems = [
{icon:"👤",label:"Profil bearbeiten"},
{icon:"🔔",label:"Benachrichtigungen"},
{icon:"🔒",label:"Sicherheit"},
{icon:"🌐",label:"Sprache"},
{icon:"❓",label:"Hilfe"}
]

return(
<div className="min-h-screen bg-gradient-to-b from-purple-700 to-slate-900 text-white p-6">

<h1 className="text-3xl font-bold mb-6">👤 Profil</h1>

<div className="bg-slate-800 p-6 rounded-xl mb-6 text-center">
<div className="w-20 h-20 bg-purple-500 rounded-full mx-auto mb-3 flex items-center justify-center text-3xl">
{user.name.charAt(0)}
</div>
<p className="text-xl font-bold">{user.name}</p>
<p className="text-sm opacity-50">{user.email}</p>
<p className="mt-2 text-amber-400">Level {user.level}</p>
</div>

<div className="grid grid-cols-3 gap-4 mb-6">
<div className="bg-slate-800 p-4 rounded-xl text-center">
<p className="text-2xl font-bold">{user.coins}</p>
<p className="text-xs opacity-50">Coins</p>
</div>
<div className="bg-slate-800 p-4 rounded-xl text-center">
<p className="text-2xl font-bold">{user.gamesPlayed}</p>
<p className="text-xs opacity-50">Spiele</p>
</div>
<div className="bg-slate-800 p-4 rounded-xl text-center">
<p className="text-2xl font-bold">{user.totalEarned}</p>
<p className="text-xs opacity-50">Verdient</p>
</div>
</div>

<div className="bg-slate-800 rounded-xl overflow-hidden">
{menuItems.map((item,i)=>(
<button
key={i}
className="w-full p-4 flex items-center gap-4 hover:bg-slate-700 transition border-b border-slate-700 last:border-0"
>
<span className="text-xl">{item.icon}</span>
<span>{item.label}</span>
<span className="ml-auto opacity-50">→</span>
</button>
))}
</div>

<button className="w-full mt-6 bg-red-600 p-4 rounded-xl font-bold">
🚪 Abmelden
</button>

</div>
)
}
