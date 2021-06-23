const { expect } = require("chai");


// function to add 18 zeros to each number (of token)
function token(n){
	return BigInt(n* (10**18));
}


let tokenA
let tokenB
let ammTest
let investor1
let investor2
let investor3
let investor4
let swap1
let swap2
let swap3
let result




	before(async () => {
		
	// get accounts
	[owner, investor1, investor2, investor3, investor4, swap1, swap2, swap3] = await ethers.getSigners();
	
	
	// load smart contracts
	  
	// deploy TokenA  
	const TokenA = await hre.ethers.getContractFactory("TokenA");
	tokenA = await TokenA.deploy();  
    await tokenA.deployed();
	tokenA.mint(investor1.address, token(25))
	tokenA.mint(investor2.address, token(25))
	tokenA.mint(investor3.address, token(50))
	tokenA.mint(investor4.address, token(50))
	tokenA.mint(swap1.address, token(23))
	tokenA.mint(swap3.address, token(10000))
	
	
	// deploy TokenB  
	const TokenB = await hre.ethers.getContractFactory("TokenB");
	tokenB = await TokenB.deploy();  
    await tokenB.deployed();
	tokenB.mint(investor1.address, token(250))
	tokenB.mint(investor2.address, token(250))
	tokenB.mint(investor3.address, token(500))	
	tokenB.mint(investor4.address, token(500))	
	tokenB.mint(swap2.address, token(115))	
	tokenB.mint(swap3.address, token(10000))	

	  
	// deploy AMMTest  with address of tokenA & tokenB
    const AMMTest = await ethers.getContractFactory("AMMTest");
    ammTest = await AMMTest.deploy(tokenA.address, tokenB.address);
    await ammTest.deployed();
	})

	

describe("Setup of accounts", function() {
  it("investor and swap accounts have received tokens A and B", async function() {
	result = await tokenA.balanceOf(investor1.address)
	expect(result).to.equal(token(25))
	
	result = await tokenA.balanceOf(investor2.address)
	expect(result).to.equal(token(25))
	
	result = await tokenA.balanceOf(investor3.address)
	expect(result).to.equal(token(50))
	
	result = await tokenB.balanceOf(investor1.address)
	expect(result).to.equal(token(250))
	
	result = await tokenB.balanceOf(investor2.address)
	expect(result).to.equal(token(250))
	
	result = await tokenB.balanceOf(investor3.address)
	expect(result).to.equal(token(500))	
	
	result = await tokenA.balanceOf(swap1.address)
	expect(result).to.equal(token(23))
	
	result = await tokenB.balanceOf(swap2.address)
	expect(result).to.equal(token(115))	
	
	result = await tokenA.balanceOf(swap3.address)
	expect(result).to.equal(token(10000))
	
	result = await tokenB.balanceOf(swap3.address)
	expect(result).to.equal(token(10000))
  });
});

describe("AMMTest", function() {
  it("has addresses of tokenA and tokenB contract correctly stored", async function() {
    expect(await ammTest.tokenA()).to.equal(tokenA.address);
    expect(await ammTest.tokenB()).to.equal(tokenB.address);

  });
  
  it("accepts liquidity deposits and issues LP tokens in return", async function() {
	// register approval for AMMTest smart contract on behalf of investors
		// for token A
	await tokenA.connect(investor1).approve(ammTest.address, token(25))
	expect(await tokenA.allowance(investor1.address, ammTest.address)).to.equal(token(25))
	await tokenA.connect(investor2).approve(ammTest.address, token(25))
	expect(await tokenA.allowance(investor2.address, ammTest.address)).to.equal(token(25))
	await tokenA.connect(investor3).approve(ammTest.address, token(50))
	expect(await tokenA.allowance(investor3.address, ammTest.address)).to.equal(token(50))
		// for token B
	await tokenB.connect(investor1).approve(ammTest.address, token(250))
	expect(await tokenB.allowance(investor1.address, ammTest.address)).to.equal(token(250))
	await tokenB.connect(investor2).approve(ammTest.address, token(250))
	expect(await tokenB.allowance(investor2.address, ammTest.address)).to.equal(token(250))
	await tokenB.connect(investor3).approve(ammTest.address, token(500))
	expect(await tokenB.allowance(investor3.address, ammTest.address)).to.equal(token(500))
	
	// add liquidity
		// check LP token balance before 
	expect(await ammTest.balanceOf(investor1.address)).to.equal(0)
	expect(await ammTest.balanceOf(investor2.address)).to.equal(0)
	expect(await ammTest.balanceOf(investor3.address)).to.equal(0)
		// add liquidity
	await ammTest.connect(investor1).addLiquidity(token(25),token(250))
	await ammTest.connect(investor2).addLiquidity(token(25),token(250))
	await ammTest.connect(investor3).addLiquidity(token(50),token(500))
		// check if LP token balance has increased
	expect(await ammTest.balanceOf(investor1.address)).to.be.above(token(79))
	expect(await ammTest.balanceOf(investor1.address)).to.be.below(token(80))
	expect(await ammTest.balanceOf(investor2.address)).to.be.above(token(79))
	expect(await ammTest.balanceOf(investor2.address)).to.be.below(token(80))
	expect(await ammTest.balanceOf(investor3.address)).to.be.above(token(158))
	expect(await ammTest.balanceOf(investor3.address)).to.be.below(token(159))

  });  
  
  it("prevents withdrawals with invalid input", async function() {  
  	// reverts if withdraw amount is 0 or higher than investor's LP token balance
	await expect(ammTest.connect(investor3).withdrawLiquidity(0)).to.be.revertedWith("AMMTest: withdrawal amount must be greater than 0")
	await expect(ammTest.connect(investor3).withdrawLiquidity(token(160))).to.be.revertedWith("AMMTest: Insufficient LP token balance for withdrawal")
	await expect(ammTest.connect(swap1).withdrawLiquidity(token(1))).to.be.revertedWith("AMMTest: Insufficient LP token balance for withdrawal")
  }); 	
	
  
  it("accepts withdrawals, burns LP tokens and returns underlying assets", async function() {
	// investor3----------------------------------------------------------
	// check LP token balance
	expect(await ammTest.balanceOf(investor3.address)).to.be.above(token(158))
	expect(await ammTest.balanceOf(investor3.address)).to.be.below(token(159))
	
	// check token A & B balance
	result = await tokenA.balanceOf(investor3.address)
	expect(result).to.equal(0)
	result = await tokenB.balanceOf(investor3.address)
	expect(result).to.equal(0)

	// call withdraw function
		// succeeds if within investor's balance
	// await ammTest.connect(investor3).withdrawLiquidity(token(158))
	await ammTest.connect(investor3).withdrawLiquidity(await ammTest.balanceOf(investor3.address))
	
	// check LP token balance
	expect(await ammTest.balanceOf(investor3.address)).to.equal(0)
	
	// check token A & B balance
	result = await tokenA.balanceOf(investor3.address)
	expect(result).to.be.above(token(49))		// rounding difference issue
	result = await tokenB.balanceOf(investor3.address)
	expect(result).to.be.above(token(499))		// rounding difference issue


	// investor1----------------------------------------------------------
	// check LP token balance
	expect(await ammTest.balanceOf(investor1.address)).to.be.above(token(79)) // rounding difference issue

	
	// check token A & B balance
	result = await tokenA.balanceOf(investor1.address)
	expect(result).to.equal(0)
	result = await tokenB.balanceOf(investor1.address)
	expect(result).to.equal(0)

	// call withdraw function
	// await ammTest.connect(investor1).withdrawLiquidity(token(79))	// rounding difference issue
	await ammTest.connect(investor1).withdrawLiquidity(await ammTest.balanceOf(investor1.address))
	
	// check LP token balance
	expect(await ammTest.balanceOf(investor1.address)).to.equal(0)
	
	// check token A & B balance
	result = await tokenA.balanceOf(investor1.address)
	expect(result).to.be.above(token(24.9))		// rounding difference issue
	result = await tokenB.balanceOf(investor1.address)
	expect(result).to.be.above(token(249))		// rounding difference issue
  });  
  
  it("allows swaps in both directions", async function() {
	
	// approve to-be-swapped amount for AMMTest smart contract on behalf of swap account
	await tokenA.connect(swap1).approve(ammTest.address, token(10))
	expect(await tokenA.allowance(swap1.address, ammTest.address)).to.equal(token(10))
	await tokenB.connect(swap2).approve(ammTest.address, token(115))
	expect(await tokenB.allowance(swap2.address, ammTest.address)).to.equal(token(115))
	// check token A & B balance before swap
	result = await tokenA.balanceOf(swap1.address)
	expect(result).to.equal(token(23))
	result = await tokenB.balanceOf(swap1.address)
	expect(result).to.equal(token(0))
	
	//conduct swap#1
	// swapping 1 A token into B token
	await ammTest.connect(swap1).swap(token(1),tokenA.address)	
	// check if token A & B balance have changed as expected
	result = await tokenA.balanceOf(swap1.address)
	expect(result).to.equal(token(22))
	result = await tokenB.balanceOf(swap1.address)
	expect(result).to.be.above(token(9))	
	expect(result).to.be.below(token(10))	
	
	//conduct swap#2
	// swapping 1 A token into B token
	await ammTest.connect(swap1).swap(token(1),tokenA.address)	
	// check if token A & B balance have changed as expected
	result = await tokenA.balanceOf(swap1.address)
	expect(result).to.equal(token(21))
	result = await tokenB.balanceOf(swap1.address)
	expect(result).to.be.above(token(18))	
	expect(result).to.be.below(token(19))	

	//conduct swap#3
	// swapping 3 A token into B token	
	await ammTest.connect(swap1).swap(token(1),tokenA.address)	
	// check if token A & B balance have changed as expected
	result = await tokenA.balanceOf(swap1.address)
	expect(result).to.equal(token(20))
	result = await tokenB.balanceOf(swap1.address)
	expect(result).to.be.above(token(26))	
	expect(result).to.be.below(token(27))			

	console.log("---");
	//conduct swap#4
	// swapping 1 B token into A token	
	await ammTest.connect(swap2).swap(token(10),tokenB.address)	
	// check if token A & B balance have changed as expected
	result = await tokenB.balanceOf(swap2.address)
	expect(result).to.equal(token(105))
	result = await tokenA.balanceOf(swap2.address)
	expect(result).to.be.above(token(1.2))	
	expect(result).to.be.below(token(1.3))	
	
	//conduct swap#5
	// swapping 1 B token into A token	
	await ammTest.connect(swap2).swap(token(10),tokenB.address)	
	// check if token A & B balance have changed as expected
	result = await tokenB.balanceOf(swap2.address)
	expect(result).to.equal(token(95))
	result = await tokenA.balanceOf(swap2.address)
	expect(result).to.be.above(token(2.3))	
	expect(result).to.be.below(token(2.4))	
	
	//conduct swap#6
	// swapping 5 B token into A token	
	await ammTest.connect(swap2).swap(token(10),tokenB.address)	
	// check if token A & B balance have changed as expected
	result = await tokenB.balanceOf(swap2.address)
	expect(result).to.equal(token(85))
	result = await tokenA.balanceOf(swap2.address)
	expect(result).to.be.above(token(3.3))	
	expect(result).to.be.below(token(3.4))
  });	  

  it("prevents swaps with invalid inputs", async function() {
	
	// 0 amount	
	await expect(ammTest.connect(swap1).swap(0, tokenA.address)).to.be.revertedWith("AMMTest: Swap amount cannot be 0")
	
	// wrong token address 
	await expect(ammTest.connect(swap1).swap(1, investor1.address)).to.be.revertedWith("AMMTest: Invalid token addresses provided")
	
	// missing approval for token A
	await expect(ammTest.connect(swap3).swap(token(1), tokenA.address)).to.be.revertedWith("MyERC20: approval required for token transfer")

  });





});


