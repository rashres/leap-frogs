package com.neueda.leap;

// Random lets us generate a random number.
// Scanner lets us read what the user types.
import java.util.Random;
import java.util.Scanner;

public class Main {

    public static void main(String[] args) {

        // Create a Scanner so we can read input from the keyboard.
        Scanner scanner = new Scanner(System.in);

        // Create a Random object so we can generate random numbers.
        Random random = new Random();

        // Ask the user to choose heads or tails.
        System.out.println("Heads or Tails?");

        // Read the user's answer.
        // trim() removes extra spaces.
        // toLowerCase() changes the answer to lowercase,
        // so "Heads", "HEADS", and "heads" all become "heads".
        String userInput = scanner.nextLine().trim().toLowerCase();

        // Generate a random number: either 0 or 1.
        // nextInt(2) means: give me a number from 0 up to (but not including) 2.
        int coin = random.nextInt(2);

        // We will store "heads" or "tails" in this variable.
        String result;

        // If the random number is 0, the coin is heads.
        if (coin == 0) {
            result = "heads";
        } else {
            // If the random number is 1, the coin is tails.
            result = "tails";
        }

        // Tell the user what the coin landed on.
        System.out.println("The coin landed on: " + result);

        // Compare the user's guess with the random result.
        if (userInput.equals(result)) {

            // The guess matches the result!
            System.out.println("You guessed correctly! :) 🎉");

        } else {

            // The guess does not match the result.
            System.out.println("Wrong guess! :(");
        }

        // Close the Scanner when we are finished using it.
        scanner.close();
    }
}