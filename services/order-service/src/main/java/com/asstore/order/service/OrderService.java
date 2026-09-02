package com.asstore.order.service;

import com.asstore.order.domain.Address;
import com.asstore.order.domain.Order;
import com.asstore.order.repository.AddressRepository;
import com.asstore.order.repository.OrderRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class OrderService {
    @Autowired
    private OrderRepository orderRepository;
    @Autowired
    private AddressRepository addressRepository;

    public Order createOrder(Order order, Address address) {
        Address savedAddress;
        if (address != null && address.getId() != null) {
            // Try to find existing address
            savedAddress = addressRepository.findById(address.getId()).orElseGet(() -> addressRepository.save(address));
        } else {
            // Create new address entry
            savedAddress = addressRepository.save(address);
        }
        order.setAddress(savedAddress);
        return orderRepository.save(order);
    }
}
