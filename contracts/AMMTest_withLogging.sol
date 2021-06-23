// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;


//imports                                       // safemath not required due to solc 0.8.0
import './interfaces/IERC20.sol';
import './MyERC20.sol';
import "./libraries/Babylonian.sol";
import "hardhat/console.sol";                   


contract AMMTest is MyERC20 {


    // token addresses
    address public tokenA;  
    address public tokenB; 
    bool logMessages = true;                    


    constructor(address _tokenA, address _tokenB)
    {
        // store token addresses
        tokenA = _tokenA;
        tokenB = _tokenB;
    }

    /*
    * @notice allows users to deposit liquidity to the pool 
    * @param _amountTokenA the amount of liquidity (in token A) to be deposited
    * @param _amountTokenB the amount of liquidity (in token B) to be deposited
    */
    function addLiquidity(uint _amountTokenA, uint _amountTokenB)    
    external 
    {
        // console.log("----------------------------------------------------------------------------------------");    
        // console.log("Add liquidity (tokenA) (tokenB): (%s)  (%s)",_amountTokenA, _amountTokenB );    
        // console.log("Liquidity Pool Size before: %s", getLiquidityPoolSize());

        // we assume sufficient balance and prior approval by the user for both coins (otherwise transaction will revert anyway)
        // transfer token A from user to this contract  
        IERC20(tokenA).transferFrom(msg.sender, address(this), _amountTokenA);

        // transfer token B from user to this contract  
        IERC20(tokenB).transferFrom(msg.sender, address(this), _amountTokenB);
 
        // Calculate the geometric mean of the user's contribution to the pool (as done by Uniswap)
        // LPtokensToBeMinted = sqrt(amountTokenA * amountTokenB)
        uint256 poolShare = Babylonian.sqrt(_amountTokenA * _amountTokenB);
        // console.log("poolShare: %s", poolShare);

        // mint new LP tokens (in amount of geometric mean) and transfer the calculated amount to the user
        _mint(msg.sender, poolShare);

        // console.log("Liquidity Pool Size after: %s", getLiquidityPoolSize());

        // // get balances of token A and token B
        // (uint balanceTokenA, uint balanceTokenB) = getBalances();
        // console.log("balanceTokenA: %s", balanceTokenA);
        // console.log("balanceTokenB: %s", balanceTokenB);
  
        // console.log("----------------------------------------------------------------------------------------"); 
    }

    /*
    * @notice allows users to withdraw liquidity from the pool)
    * @param _amountLPtokens the amount of liquidity (in LP tokens) to be withdrawn
    */
    function withdrawLiquidity(uint256 _amountLPtokens)
    external 
    {
        // check if sender has sufficient balance
        require(_amountLPtokens > 0, "AMMTest: withdrawal amount must be greater than 0");
        require(balanceOf[msg.sender] >= _amountLPtokens,  "AMMTest: Insufficient LP token balance for withdrawal");
     
        // console.log("_amountLPtokens: %s", _amountLPtokens);
        // determine size of whole liquidity pool
            // get balances of token A and token B
            (uint balanceTokenA, uint balanceTokenB) = getBalances();
            // calculate total liquidity pool size 
            // pool size = sqrt(a*b)
            uint256 poolSize = Babylonian.sqrt(balanceTokenA * balanceTokenB);
        // console.log("poolSize: %s", poolSize);


        // burn LP token 
        _burn(msg.sender, _amountLPtokens);

        // calculate ratio of withdrawn LP tokens compared to total pool size
            // multiplying _amountLPtokens by 10**18 in order to create a virtual floating point number
            // console.log("_amountLPtokens*(10**18)): %s", _amountLPtokens*(10**18));
            uint256 shareRatio = (_amountLPtokens*(10**18)) / poolSize /** (10**18)*/;

        // console.log("shareRatio: %s", shareRatio);


        // calculate the amount of each token to be transferred to the sender
            uint256 tokenAWithdrawalAmount = (balanceTokenA * shareRatio) / 10**18;
            uint256 tokenBWithdrawalAmount = (balanceTokenB * shareRatio) / 10**18;    
        // console.log("tokenAWithdrawalAmount: %s", tokenAWithdrawalAmount);   
        // console.log("tokenBWithdrawalAmount: %s", tokenBWithdrawalAmount);   

        // transfer token A from user to this contract  
        IERC20(tokenA).transfer(msg.sender, tokenAWithdrawalAmount);

        // transfer token B from user to this contract  
        IERC20(tokenB).transfer(msg.sender, tokenBWithdrawalAmount);
    }

    /*
    * @notice allows users to swap coins between A and B (both directions)
    * @param _amount the amount to be swapped (in tokenA)
    * @param _fromToken the address of the token to be swapped from
    */
    function swap(uint256 _amount, address _fromToken)
    external
    {
            // parameter checks
            require(_fromToken == tokenA || _fromToken == tokenB, "AMMTest: Invalid token addresses provided");
            require(_amount > 0, "AMMTest: Swap amount cannot be 0");
            // get current balances of both token
            (uint balanceTokenA, uint balanceTokenB) = getBalances();

            // check which token was provided
            if(_fromToken == tokenA){
                // swap from A to B
                console.log("Swap A to B with amount:     %s", _amount);
                _swapToken(_amount, tokenA, tokenB, balanceTokenA, balanceTokenB);

            }else{
                // swap from B to A
                console.log("Swap B to A with amount:    %s", _amount);
                _swapToken(_amount,  tokenB, tokenA, balanceTokenB, balanceTokenA);
            }
            console.log("---------------------------------------");
    }



    function _swapToken(uint256 _amount, address tokenAddress0, address tokenAddress1, uint256 _balanceToken0, uint256 _balanceToken1)
    private
    {

        //------for debugging only----------------
        // get balances of token A and token B
        (uint balTokenA, uint balTokenB) = getBalances();
        console.log("k before swap:  %s",getLiquidityPoolSize() );
        console.log("balanceTokenA before swap:  %s", balTokenA);
        console.log("balanceTokenB before swap: %s", balTokenB);
        //------for debugging only-----------------


        // determine constant product (k) i.e. product of amounts of token A and B
        // calculate k = A * B
        uint256 k = getLiquidityPoolSize();

        // make sure that liquidity is sufficient for this trade
        // max balance for token A with given liquidity is = k  (which would leave token B with amount 1 while still maintaining constant product k)
        // as a result, max swap amount for A cannot be greater than (k  - current balance of A)
        require((_amount + _balanceToken0) <= k, "AMMTest: Insufficient liquidity for this swap");

        // determine swap conditions
            // calculate how many tokens of token1 must be in the pool afterwards to maintain constant product k
            // for that we divide k by the current balance plus the amount of token0 to be swapped
            uint256 targetTokenAmount1 = k / (_balanceToken0 + _amount);


            // calculate how many token1 should be given to the sender to achieve the targetTokenAmount1
            // for that we calculate  currrentTokenAmount1 - targetTokenAmount1
            uint swapAmountToken1 = _balanceToken1 - targetTokenAmount1;

            // This approach would solve the problem with rounding errors and would 
            // help to maintain the product k (it gets bigger with every swap), but seems like a dirty solution
            // >> still looking for a better solution
            swapAmountToken1--;

        // conduct swap
            // transfer token0 from user to this contract (assuming approval has been granted before the swap)
            // not using safetransfer for simplicity purpose                                    
            IERC20(tokenAddress0).transferFrom(msg.sender, address(this), _amount);

            // transfer calculated amount of token1 from this contract to user
            IERC20(tokenAddress1).transfer(msg.sender, swapAmountToken1);


            // final check to make sure that k is equal or greater now  
            require(getLiquidityPoolSize() >= k, "AMMtest: Error in swap function, pool size decreased");



        //------for debugging only----------------
        // get balances of token A and token B
        (balTokenA, balTokenB) = getBalances();
        console.log("k after swap:   %s",getLiquidityPoolSize() );
        console.log("balanceTokenA after swap:   %s", balTokenA);
        console.log("balanceTokenB after swap:  %s", balTokenB);
        //------for debugging only-----------------

    }

    function getLiquidityPoolSize() private view returns (uint256){

        // get balances of token A and token B
        (uint balanceTokenA, uint balanceTokenB) = getBalances();
        // calculate total liquidity pool size 
        return balanceTokenA * balanceTokenB;

    }

    function getBalances() 
    internal 
    view
    returns (uint reserveA, uint reserveB){
        reserveA = IERC20(tokenA).balanceOf(address(this));
        reserveB = IERC20(tokenB).balanceOf(address(this));
    }

}