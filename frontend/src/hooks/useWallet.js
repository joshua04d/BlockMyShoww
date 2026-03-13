import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'

export function useWallet() {
  const [provider, setProvider]   = useState(null)
  const [signer, setSigner]       = useState(null)
  const [address, setAddress]     = useState(null)
  const [chainId, setChainId]     = useState(null)
  const [error, setError]         = useState(null)
  const [connecting, setConnecting] = useState(false)

  const SEPOLIA_CHAIN_ID = '0xaa36a7'

  // Auto-reconnect if already connected
  useEffect(() => {
    if (!window.ethereum) return
    window.ethereum.request({ method: 'eth_accounts' }).then(accounts => {
      if (accounts.length > 0) connect(true)
    })
  }, [])

  // Listen for account/chain changes
  useEffect(() => {
    if (!window.ethereum) return
    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) disconnect()
      else setAddress(accounts[0])
    }
    const handleChainChanged = () => window.location.reload()
    window.ethereum.on('accountsChanged', handleAccountsChanged)
    window.ethereum.on('chainChanged', handleChainChanged)
    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
      window.ethereum.removeListener('chainChanged', handleChainChanged)
    }
  }, [])

  const connect = useCallback(async (silent = false) => {
    if (!window.ethereum) {
      setError('MetaMask not found. Please install it.')
      return
    }
    try {
      setConnecting(true)
      setError(null)
      const _provider = new ethers.BrowserProvider(window.ethereum)

      // Request accounts
      if (!silent) await window.ethereum.request({ method: 'eth_requestAccounts' })

      const _signer  = await _provider.getSigner()
      const _address = await _signer.getAddress()
      const network  = await _provider.getNetwork()
      const _chainId = '0x' + network.chainId.toString(16)

      setProvider(_provider)
      setSigner(_signer)
      setAddress(_address)
      setChainId(_chainId)
    } catch (err) {
      if (!silent) setError(err.message || 'Connection failed')
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    setProvider(null)
    setSigner(null)
    setAddress(null)
    setChainId(null)
  }, [])

  const switchToSepolia = useCallback(async () => {
    if (!window.ethereum) return
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CHAIN_ID }]
      })
    } catch (err) {
      setError('Could not switch to Sepolia. Add it to MetaMask first.')
    }
  }, [])

  const isConnected  = !!address
  const isOnSepolia  = chainId === SEPOLIA_CHAIN_ID
  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null

  return {
    provider,
    signer,
    address,
    chainId,
    error,
    connecting,
    isConnected,
    isOnSepolia,
    shortAddress,
    connect,
    disconnect,
    switchToSepolia,
  }
}