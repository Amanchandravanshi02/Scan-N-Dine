import { Order } from "../models/order.model.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import crypto from "crypto"

// generate unique booking number
const generateOrderToken = async () => {

    try {
        let unique = false
        let token
        while (!unique) {

            token = crypto.randomInt(10000000, 100000000)
            const existingBooking = await Order.findOne({ bookingToken: token })

            if (!existingBooking) {
                unique = true
            }
        }
        return token
    } catch (err) {
        console.log("booking no generation err", err)
        throw new ApiError(500, "Something went wrong while generating booking number")
    }
}

const placeOrder = asyncHandler(async (req, res) => {
    const { resid } = req.params
    const { items, taxPrice, totalPrice } = req.body

    if (items && items.length === 0) {
        throw new ApiError(400, "No items in order")
    }

    const orderNo = await generateOrderToken()
    const order = await Order.create({
        user: req.user?._id,
        restaurantId: resid,
        orderNo,
        items: items.map((item) => ({
            ...item,
            menu: item._id,
        })),
        taxPrice,
        totalPrice,
    })

    const placedOrder = await Order.findById(order._id)

    if (!placedOrder) {
        throw new ApiError(500, "Something went wrong while placing order")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, placedOrder, "Order placed successfully"))

})

const getMyOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find({ user: req.user?._id })

    if (!orders) {
        throw new ApiError(400, "No orders found")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, orders, "Orders fetched successfully."))
})

const getOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find({ restaurantId: req.user?.restaurantId })
    console.log("Orders: ", orders)

    if (!orders && orders.length === 0) {
        throw new ApiError(404, "Order not found")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, orders, "Orders fetched successfully."))
})

const addItem = asyncHandler(async (req, res) => {
    const { orderid } = req.params
    const { items } = req.body

    const order = await Order.findById(orderid)

    if (!order) {
        throw new ApiError(404, "Order not found")
    }

    order.items.push(...items.map((item) => ({
        ...item,
        menu: item._id,
    })));

    order.totalPrice += items.reduce((acc, item) => acc + item.price * item.quantity, 0);

    if (order.status === 'Served') {
        order.status = 'Pending'
    }

    await order.save({ validateBeforeSave: false })

    return res
        .status(200)
        .json(new ApiResponse(200, order, "Order added successfully."))
})

const updateOrderStatus = asyncHandler(async (req, res) => {
    const { orderid } = req.params
    const { status } = req.body

    const order = await Order.findById(orderid)


    if (!order) {
        throw new ApiError(404, "Order not found")
    }

    if (order.status === status) {
        throw new ApiError(402, `Order is already in${order.status}`)
    }

    order.status = status
    await order.save({ validateBeforeSave: false })

    return res
        .status(200)
        .json(new ApiResponse(200, order, "Status updated successfully."))
})

export {
    placeOrder,             // user
    getMyOrders,           // user
    addItem,             // user
    getOrders,            // restaurant owner
    updateOrderStatus,  // restaurant owner
}