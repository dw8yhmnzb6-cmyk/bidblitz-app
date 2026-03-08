// BidBlitz Economy Manager
// Verwaltet den gesamten Coin-Kreislauf

class EconomyManager {

  constructor() {
    this.key = "bbz_coins"
  }

  // Coins abrufen
  getBalance() {
    return parseInt(localStorage.getItem(this.key) || "0")
  }

  // Coins hinzufügen (Games, Rewards, Mining)
  addCoins(amount, source) {
    const balance = this.getBalance()
    const newBalance = balance + amount
    localStorage.setItem(this.key, newBalance)
    
    this.logTransaction({
      type: "earn",
      amount: amount,
      source: source,
      balance: newBalance
    })
    
    return newBalance
  }

  // Coins ausgeben (Taxi, Scooter, Bike, Services)
  spendCoins(amount, service) {
    const balance = this.getBalance()
    
    if (balance < amount) {
      return { success: false, message: "Not enough coins" }
    }
    
    const newBalance = balance - amount
    localStorage.setItem(this.key, newBalance)
    
    this.logTransaction({
      type: "spend",
      amount: amount,
      service: service,
      balance: newBalance
    })
    
    return { success: true, balance: newBalance }
  }

  // Prüfen ob genug Coins
  canAfford(amount) {
    return this.getBalance() >= amount
  }

  // Transaktion loggen
  logTransaction(tx) {
    const logs = JSON.parse(localStorage.getItem("bbz_transactions") || "[]")
    logs.push({
      ...tx,
      timestamp: new Date().toISOString()
    })
    localStorage.setItem("bbz_transactions", JSON.stringify(logs.slice(-50)))
  }

  // Transaktions-Historie
  getHistory() {
    return JSON.parse(localStorage.getItem("bbz_transactions") || "[]")
  }

  // Reset (für Tests)
  reset() {
    localStorage.setItem(this.key, "0")
    localStorage.setItem("bbz_transactions", "[]")
  }

}

export default new EconomyManager()
