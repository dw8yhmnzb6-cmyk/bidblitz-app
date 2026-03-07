// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BidBlitz Token (BBZ)
 * @dev ERC-20 Token for BidBlitz Super App
 * Network: BNB Smart Chain (BSC)
 * Total Supply: 1,000,000,000 BBZ
 */
contract BidBlitzToken {

    string public name = "BidBlitz";
    string public symbol = "BBZ";
    uint8 public decimals = 18;

    uint256 public totalSupply;

    address public owner;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor() {

        owner = msg.sender;

        uint256 supply = 1000000000 * 10**decimals;

        totalSupply = supply;

        balanceOf[msg.sender] = supply;

        emit Transfer(address(0), msg.sender, supply);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function transfer(address to, uint256 value) public returns(bool){

        require(balanceOf[msg.sender] >= value, "balance too low");
        require(to != address(0), "transfer to zero address");

        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;

        emit Transfer(msg.sender, to, value);

        return true;
    }

    function approve(address spender, uint256 value) public returns(bool){

        allowance[msg.sender][spender] = value;

        emit Approval(msg.sender, spender, value);

        return true;
    }

    function transferFrom(address from, address to, uint256 value) public returns(bool){

        require(balanceOf[from] >= value, "balance too low");
        require(allowance[from][msg.sender] >= value, "allowance too low");
        require(to != address(0), "transfer to zero address");

        allowance[from][msg.sender] -= value;

        balanceOf[from] -= value;
        balanceOf[to] += value;

        emit Transfer(from, to, value);

        return true;
    }

    function burn(uint256 value) public {

        require(balanceOf[msg.sender] >= value, "balance too low");

        balanceOf[msg.sender] -= value;
        totalSupply -= value;

        emit Transfer(msg.sender, address(0), value);
    }

    function mint(address to, uint256 value) public onlyOwner {

        require(to != address(0), "mint to zero address");

        totalSupply += value;
        balanceOf[to] += value;

        emit Transfer(address(0), to, value);
    }

    function transferOwnership(address newOwner) public onlyOwner {

        require(newOwner != address(0), "new owner is zero address");

        emit OwnershipTransferred(owner, newOwner);

        owner = newOwner;
    }

    function renounceOwnership() public onlyOwner {

        emit OwnershipTransferred(owner, address(0));

        owner = address(0);
    }

}
