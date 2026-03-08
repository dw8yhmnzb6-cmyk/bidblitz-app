import React, { createContext, useContext, useState, useEffect } from "react";

// Coin System Context
const CoinContext = createContext()

export function CoinProvider({ children }) {

  const [coins, setCoins] = useState(0)
  const [history, setHistory] = useState([])

  // Beim Start laden
  useEffect(() => {
    const saved = localStorage.getItem("bbz_coins")
    if (saved) setCoins(parseInt(saved))
    
    const logs = localStorage.getItem("bbz_transactions")
    if (logs) setHistory(JSON.parse(logs))
  }, [])

  // Coins speichern
  useEffect(() => {
    localStorage.setItem("bbz_coins", coins)
  }, [coins])

  // ═══════════════════════════════════
  // VERDIENEN (Games, Mining, Rewards)
  // ═══════════════════════════════════

  function earnCoins(amount, source) {
    setCoins(prev => prev + amount)
    addToHistory("earn", amount, source)
    return true
  }

  // ═══════════════════════════════════
  // AUSGEBEN (Taxi, Scooter, Bike)
  // ═══════════════════════════════════

  function spendCoins(amount, service) {
    if (coins < amount) {
      alert("Not enough coins!")
      return false
    }
    setCoins(prev => prev - amount)
    addToHistory("spend", amount, service)
    return true
  }

  // ═══════════════════════════════════
  // PRÜFEN
  // ═══════════════════════════════════

  function canAfford(amount) {
    return coins >= amount
  }

  // ═══════════════════════════════════
  // HISTORIE
  // ═══════════════════════════════════

  function addToHistory(type, amount, desc) {
    const entry = {
      type,
      amount,
      desc,
      time: new Date().toLocaleString()
    }
    const newHistory = [...history, entry].slice(-50)
    setHistory(newHistory)
    localStorage.setItem("bbz_transactions", JSON.stringify(newHistory))
  }

  // ═══════════════════════════════════
  // PREISE
  // ═══════════════════════════════════

  const prices = {
    taxi: 50,
    scooter: 20,
    bike: 10,
    miner: 100
  }

  return (
    <CoinContext.Provider value={{
      coins,
      history,
      earnCoins,
      spendCoins,
      canAfford,
      prices
    }}>
      {children}
    </CoinContext.Provider>
  )

}

// Hook zum Verwenden
export function useCoins() {
  const context = useContext(CoinContext)
  if (!context) {
    throw new Error("useCoins must be used within CoinProvider")
  }
  return context
}
