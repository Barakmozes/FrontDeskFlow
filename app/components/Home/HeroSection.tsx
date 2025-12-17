'use client'

import React from 'react'
import Image from 'next/image'
import { useKeenSlider, KeenSliderPlugin } from 'keen-slider/react'
import 'keen-slider/keen-slider.min.css'
import { HiStar } from 'react-icons/hi2'
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa'
import RestaurantDetailsModal from './RestaurantDetailsModal'

/**
 * Autoplay plugin for Keen Slider
 */
function Autoplay(delay = 3000): KeenSliderPlugin {
  let timer: ReturnType<typeof setTimeout>
  return (slider) => {
    const clear = () => clearTimeout(timer)
    const next = () => {
      clear()
      timer = setTimeout(() => slider.next(), delay)
    }
    slider.on('created', next)
    slider.on('animationEnded', next)
    slider.on('updated', next)
    slider.on('dragStarted', clear)
  }
}

export default function HeroSection() {
  const slides = [
    '/img/banner5.jpg',
    '/img/banner6.jpg',
    '/img/banner4.jpg',
  ]

  const [sliderRef, instanceRef] = useKeenSlider<HTMLDivElement>(
    {
      loop: true,
      slides: {
        perView: 1,
        spacing: 0,
      },
    //   breakpoints: {
    //     '(min-width: 640px)': {
    //       slides: { perView: 1, spacing: 0 },
    //     },
    //     '(min-width: 768px)': {
    //       slides: { perView: 1, spacing: 0 },
    //     },
    //     '(min-width: 1024px)': {
    //       slides: { perView: 1, spacing: 0 },
    //     },
    //   },
    },
    [Autoplay(5000)]
  )

  return (
    <section className="relative h-72 md:h-96 overflow-hidden">
     
      {/* Carousel Container */}
      <div
        ref={sliderRef}
        className="relative h-48 md:h-72 bg-no-repeat bg-cover w-full keen-slider"
        role="region"
        aria-label="Hero carousel"
      >
        {slides.map((src, idx) => (
          <div
            key={idx}
            className="keen-slider__slide relative w-full"
          >
            <Image
              src={src}
              alt={`Slide ${idx + 1}`}
              fill
              className="object-cover object-top-right"
            />
          </div>
        ))}
      </div>

      {/* Navigation Arrows */}
      <button
        aria-label="Previous slide"
        className="absolute left-4 top-1/2 z-10 p-2 rounded-full bg-white bg-opacity-70 hover:bg-opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white transform -translate-y-1/2"
        onClick={() => instanceRef.current?.prev()}
      >
        <FaChevronLeft className="w-6 h-6 text-gray-800" />
      </button>
      <button
        aria-label="Next slide"
        className="absolute right-4 top-1/2 z-10 p-2 rounded-full bg-white bg-opacity-70 hover:bg-opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white transform -translate-y-1/2"
        onClick={() => instanceRef.current?.next()}
      >
        <FaChevronRight className="w-6 h-6 text-gray-800" />
      </button>

      {/* Overlay Content */}
      <div className="absolute bottom-4 left-4 flex items-center space-x-4 text-white">
        {/* Logo */}
        <div className="rounded-full w-24 h-24 p-1 bg-white ring-2 ring-white overflow-hidden">
          <Image
            src="/img/logo.png"
            alt="Dps-logo"
            width={96}
            height={96}
            className="object-contain"
          />
        </div>

        {/* Title, Rating & Modal */}
        <div>
        <h1 className="flex text-5xl textcolor">
  {'FrontDeskFlow'.split('').map((c,i)=>(
    <span key={i} className="inline-block animate-pop-in  text-black " style={{ animationDelay:`${i*50}ms` }}>
      {c}
    </span>
  ))}
</h1>

          <div className="flex items-center mt-1">
            <HiStar className="text-yellow-400 w-5 h-5" />
            <span className="ml-1 text-black">4.5 rating</span>
          </div>
          <div className="mt-2">
            <RestaurantDetailsModal />
          </div>
        </div>
      </div>
    </section>
  )
}
