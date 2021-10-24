/* global ethers */

CONTRACTS = {
	1: '0x90e55d9fb927af203e90d8b4b5c0557c77614b31',
	4: '0x5DC4cEEaBE13DA825AD44093E9fFAAa1651755D4',
}

document.addEventListener('DOMContentLoaded', () => {
	// Unpkg imports
	const Web3Modal = window.Web3Modal.default
	const WalletConnectProvider = window.WalletConnectProvider.default

	// Chosen wallet provider given by the dialog window
	let provider
	// Contracts
	let speedrunAI

	const providerOptions = {
		walletconnect: {
			package: WalletConnectProvider,
			options: {
				infuraId: '240248d1c65143c082ae6b411905d45a',
			},
		},
	}

	let web3Modal = new Web3Modal({
		cacheProvider: false,
		providerOptions,
		disableInjectedProvider: false,
	})

	// Update message
	function renderMessage(message, el = 'message') {
		let messageEl = document.getElementById(el)
		messageEl.innerHTML = message
	}
	// Remove message
	function clearMessage() {
		return renderMessage('')
	}
	// Update message with error
	function renderError(err, el) {
		console.log(err)
		let message = err
		if (err.code && err.reason) {
			message = `${err.code}: ${err.reason}`
		} else if (err.code && err.message) {
			message = `${err.code}: ${err.message}`
		}
		message = `<code class="error">${message}</code>`
		return renderMessage(message, el)
	}

	if (!window.SPEEDRUNAI_ABI) {
		return renderError('Could not find ABI')
	}

	// Show first section
	clearMessage()

	// Manage wallet connection
	const connectBtn = document.getElementById('connectBtn')

	const updateSaleInfo = async network => {
		const contract = CONTRACTS[network.chainId]
		const signer = provider.getSigner()
		speedrunAI = new ethers.Contract(contract, SPEEDRUNAI_ABI, signer)

		const saleToSeries = await speedrunAI.saleToSeries()
		document.getElementById('series').innerText = saleToSeries - 1
		const available = (saleToSeries - 1) * 100 // 100 tokens per series
		document.getElementById('available').innerText = available
		const supply = available == 0 ? 0 : await speedrunAI.totalSupply()
		document.getElementById('supply').innerText = supply
		const tokenPrice = await speedrunAI.pricePerToken()
		document.getElementById('price').innerText =
			tokenPrice == 0
				? 'for free'
				: `at ${ethers.utils.formatEther(tokenPrice)}Ξ per token`
		if (supply < available) {
			console.log('Sale active')
			document.getElementById('mintFlex').removeAttribute('hidden')
			document.getElementById('nomintFlex').setAttribute('hidden', true)
			return true
		} else {
			document.getElementById('nomintFlex').removeAttribute('hidden')
			document.getElementById('mintFlex').setAttribute('hidden', true)
			return false
		}
	}

	const updateNetwork = async network => {
		document.getElementById('connectFlex').setAttribute('hidden', true)
		document.getElementById('connectedFlex').removeAttribute('hidden')
		const contractAddr = CONTRACTS[network.chainId]
		if (contractAddr) {
			renderMessage('Loading...')

			const isTest = network.chainId == 4
			document.getElementById('openseaLink').href = `https://${
				isTest ? 'testnets.' : ''
			}opensea.io/collection/speedrunai`
			document.getElementById('etherscanLink').href = `https://${
				isTest ? 'rinkeby.' : ''
			}etherscan.io/address/${contractAddr}`
			document.getElementById('icons').removeAttribute('hidden')

			// Check sale
			const available = updateSaleInfo(network)
			clearMessage()
			if (available) {
				return true
			}
		} else {
			renderError('Contract not yet deployed on this network!')
		}

		// Fail out
		document.getElementById('nomintFlex').removeAttribute('hidden')
		document.getElementById('mintFlex').setAttribute('hidden', true)
		document.getElementById('icons').setAttribute('hidden', true)
		return false
	}

	connectBtn.addEventListener('click', async () => {
		await window.Web3Modal.removeLocal('walletconnect')
		try {
			provider = await web3Modal.connect()
			provider = new ethers.providers.Web3Provider(provider, 'any')
			provider.on('network', updateNetwork)
		} catch (err) {
			const msg = 'Could not get a wallet connection'
			console.log(msg, err)
			return renderError(msg)
		}
	})

	// Mint button
	const mintButton = document.getElementById('mintBtn')
	mintButton.addEventListener('click', async () => {
		await updateNetwork(provider._network)

		qty = parseFloat(document.getElementById('qty').value, 10)

		const addr = await provider.getSigner().getAddress()
		renderMessage(`Minting to ${addr}! Please wait...`)

		try {
			const tx = await speedrunAI.mint(addr, qty, {
				value: (await speedrunAI.pricePerToken()).mul(qty),
			})

			renderMessage('Waiting for confirmation...')
			await tx.wait()

			renderMessage(`<h3>Your art has been delivered!</h3>`)
			await updateSaleInfo(provider._network)
		} catch (err) {
			if (err.code === 4001) {
				renderError('Transaction declined')
			} else {
				renderError(err)
			}
		}
	})
})
