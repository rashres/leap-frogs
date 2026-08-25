package com.neueda.leap;
import java.util.Random;
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        //
        System.out.println("Hello world from Group 4's Sprint 1 project skeleton");
        System.out.println("Hello again : )");
        System.out.println("Farewell! May your code compile on the first try!");
        Random r = new Random();
        int i = r.nextInt(100);
        System.out.println("Today's lucky number is " + i);
         System.out.println("Hello again : )");

        // greet by name
       
        Scanner scanner = new Scanner(System.in);
        System.out.println("What is your name?");
        String userinput= scanner.nextLine();
        System.out.println("You entered: " + userinput);
        scanner.close();
    }

}
